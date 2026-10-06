"""QuantumPad quantum runner. Python 3.12. Credentials stay in your local environment.

Install: python -m pip install qiskit qiskit-aer qiskit-ibm-runtime amazon-braket-sdk
GPU instead of qiskit-aer: qiskit-aer-gpu (supported Linux/CUDA only).
See quantum-guide.md. No paid submission occurs without a typed confirmation.
"""
import argparse
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def save(path, data):
    Path(path).write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Saved {path}")


def load(path):
    if Path(path).stat().st_size > 200_000:
        raise ValueError("Input exceeds 200 KB")
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate(r):
    n = r.get("qubits")
    shots = r.get("shots")
    if type(n) is not int or not 1 <= n <= 8 or type(shots) is not int or not 1 <= shots <= 8192:
        raise ValueError("Use 1–8 qubits and 1–8192 shots")
    gates = r.get("gates")
    if not isinstance(gates, list) or len(gates) > 64:
        raise ValueError("Maximum 64 gates")
    for g in gates:
        kind, target = g.get("kind"), g.get("target")
        if kind not in ["H", "X", "Y", "Z", "S", "T", "RX", "RY", "RZ", "CX"] or type(target) is not int or not 0 <= target < n:
            raise ValueError("Invalid gate")
        if kind == "CX" and (type(g.get("control")) is not int or not 0 <= g["control"] < n or g["control"] == target):
            raise ValueError("Invalid control")
        if kind.startswith("R") and (type(g.get("angle")) not in (int, float) or not math.isfinite(g["angle"]) or abs(g["angle"]) > 100 * math.pi):
            raise ValueError("Invalid angle")
    return r


def ibm_service():
    from qiskit_ibm_runtime import QiskitRuntimeService
    # Never save_account: no credentials written to disk by this runner.
    return QiskitRuntimeService(channel="ibm_quantum_platform", token=os.environ["QISKIT_IBM_TOKEN"], instance=os.environ["QISKIT_IBM_INSTANCE"])


def qiskit_circuit(r):
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(r["qubits"])
    for g in r["gates"]:
        if g["kind"] == "CX":
            qc.cx(g["control"], g["target"])
        elif g["kind"].startswith("R"):
            getattr(qc, g["kind"].lower())(g["angle"], g["target"])
        else:
            getattr(qc, g["kind"].lower())(g["target"])
    qc.measure_all()
    return qc


def braket_circuit(r):
    from braket.circuits import Circuit
    # Include idle wires so the provider measures every requested qubit.
    qc = Circuit()
    for q in range(r["qubits"]):
        qc.i(q)
    for g in r["gates"]:
        if g["kind"] == "CX":
            qc.cnot(g["control"], g["target"])
        elif g["kind"].startswith("R"):
            getattr(qc, g["kind"].lower())(g["target"], g["angle"])
        else:
            getattr(qc, g["kind"].lower())(g["target"])
    return qc


def confirm(message):
    print(message)
    if input("Type SUBMIT to authorize provider usage: ").strip() != "SUBMIT":
        raise SystemExit("Cancelled; nothing submitted")


def result_document(r, provider, backend, job_id, counts):
    return {"schema": "exaflop.quantum.result.v1", "provider": provider, "backend": backend,
            "jobId": job_id, "status": "COMPLETED", "observedAt": timestamp(), "qubits": r["qubits"],
            "circuit": {"qubits": r["qubits"], "gates": r["gates"]}, "counts": dict(counts)}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("action", choices=["devices", "run", "status", "result", "cancel"])
    p.add_argument("--provider", choices=["local", "gpu", "ibm", "braket"], default="local")
    p.add_argument("--backend")
    p.add_argument("--request", default="quantum-request.json")
    p.add_argument("--receipt", default="quantum-job.json")
    p.add_argument("--output")
    args = p.parse_args()
    if args.action == "devices":
        devices = []
        if args.provider == "ibm":
            for b in ibm_service().backends():
                s = b.status()
                devices.append({"name": b.name, "provider": "IBM Quantum", "qubits": b.num_qubits,
                                "status": "operational" if s.operational else "unavailable", "queue": f"{s.pending_jobs} pending jobs", "gates": ", ".join(b.operation_names)})
        elif args.provider == "braket":
            from braket.aws import AwsDevice
            for d in AwsDevice.get_devices():
                properties = d.properties
                actions = properties.action or {}
                gates = sorted(set(g for a in actions.values() for g in getattr(a, "supportedOperations", [])))
                devices.append({"name": d.arn, "provider": d.provider_name, "qubits": getattr(properties.paradigm, "qubitCount", None),
                                "status": d.status, "queue": str(d.queue_depth()), "gates": ", ".join(gates) or "See provider device properties"})
        else:
            raise ValueError("Device discovery requires --provider ibm or braket")
        save(args.output or "devices.json", {"schema": "exaflop.quantum.devices.v1", "observedAt": timestamp(), "devices": devices})
        return

    if args.action == "run":
        r = validate(load(args.request))
        if args.provider in ("local", "gpu"):
            from qiskit import transpile
            from qiskit_aer import AerSimulator
            backend = AerSimulator(method="statevector", device="GPU" if args.provider == "gpu" else "CPU")
            if args.provider == "gpu" and "GPU" not in backend.available_devices():
                raise RuntimeError("Aer GPU unavailable. Install qiskit-aer-gpu on supported Linux/CUDA; no CPU fallback was run.")
            job = backend.run(transpile(qiskit_circuit(r), backend), shots=r["shots"])
            save(args.output or "quantum-result.json", result_document(r, f"Qiskit Aer {args.provider}", backend.name, job.job_id(), job.result().get_counts()))
            return
        if not args.backend:
            raise ValueError("Choose an explicit --backend from device discovery")
        # Persist the request BEFORE submission. A submitting marker prevents accidental retry.
        receipt_path = Path(args.receipt)
        if receipt_path.exists():
            raise ValueError("Receipt already exists. Inspect it; use a new --receipt name only for an intentional new job.")
        record = {"provider": args.provider, "backend": args.backend, "request": r, "createdAt": timestamp(), "status": "SUBMITTING", "jobId": None}
        if args.provider == "ibm":
            from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
            from qiskit_ibm_runtime import SamplerV2
            backend = ibm_service().backend(args.backend)
            qc = generate_preset_pass_manager(backend=backend, optimization_level=1).run(qiskit_circuit(r))
            confirm(f"IBM backend {args.backend}; {r['shots']} shots. Review your plan, quotas, and billing in IBM Quantum.")
            save(args.receipt, record)
            job = SamplerV2(mode=backend).run([qc], shots=r["shots"])
            record["jobId"] = job.job_id()
        else:
            from braket.aws import AwsDevice
            device = AwsDevice(args.backend)
            qc = braket_circuit(r)
            confirm(f"Braket {device.name} ({args.backend}); {r['shots']} shots. Provider task, shot, storage or simulator charges may apply.")
            save(args.receipt, record)
            job = device.run(qc, shots=r["shots"])
            record["jobId"] = job.id
        record["status"] = "SUBMITTED"
        save(args.receipt, record)
        print("Submission saved. Use status/result with this receipt. If submission errors, reconcile in the provider console before retrying.")
        return

    receipt = load(args.receipt)
    r = validate(receipt["request"])
    if not receipt.get("jobId"):
        raise ValueError("No job ID: submission may have succeeded remotely. Reconcile in the provider console; do not blindly resubmit.")
    if receipt["provider"] == "ibm":
        job = ibm_service().job(receipt["jobId"])
        status = str(job.status())
    elif receipt["provider"] == "braket":
        from braket.aws import AwsQuantumTask
        job = AwsQuantumTask(receipt["jobId"])
        status = job.state()
    else:
        raise ValueError("Unknown receipt provider")
    print(f"Job {receipt['jobId']}: {status}")
    if args.action == "status":
        return
    if args.action == "cancel":
        if input("Type CANCEL to request cancellation (incurred charges may remain): ").strip() == "CANCEL":
            print(job.cancel())
        return
    if status not in ("DONE", "COMPLETED", "JobStatus.DONE"):
        raise ValueError("Job is not completed. Check status later; no new submission was made.")
    if receipt["provider"] == "ibm":
        counts = job.result()[0].data.meas.get_counts()
    else:
        output = job.result()
        # Braket reports columns in measured_qubits order; normalize to q[n-1]…q0.
        counts = {}
        for bits, count in output.measurement_counts.items():
            mapped = dict(zip(output.measured_qubits, bits))
            key = "".join(mapped[q] for q in reversed(range(r["qubits"])))
            counts[key] = counts.get(key, 0) + int(count)
    save(args.output or "quantum-result.json", result_document(r, receipt["provider"], receipt["backend"], receipt["jobId"], counts))


if __name__ == "__main__":
    main()
