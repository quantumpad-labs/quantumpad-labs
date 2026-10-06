"""Bounded Braket Hybrid Jobs VQE example. Python 3.12 + amazon-braket-sdk.
Uses your AWS profile. Paid submission requires typed confirmation.
"""
import argparse
from pathlib import Path


def optimize():
    import math
    from braket.aws import AwsDevice
    from braket.circuits import Circuit
    from braket.jobs import get_job_device_arn
    from braket.jobs.metrics import log_metric
    device = AwsDevice(get_job_device_arn())
    history = []
    for i in range(9):
        theta = i * math.pi / 4
        # Measure Z and X in separate circuits: E = <Z> + 0.5<X>.
        values = []
        for basis in ("Z", "X"):
            circuit = Circuit().ry(0, theta)
            if basis == "X":
                circuit.h(0)
            task = device.run(circuit, shots=128)
            result = task.result()
            if result is None:
                raise RuntimeError(f"Task {task.id} failed; inspect in Braket console")
            counts = result.measurement_counts
            total = sum(counts.values())
            values.append((counts.get("0", 0) - counts.get("1", 0)) / total)
        energy = values[0] + 0.5 * values[1]
        history.append({"theta": theta, "energy": energy})
        log_metric(metric_name="energy", value=energy, iteration_number=i)
    return {"history": history, "best": min(history, key=lambda v: v["energy"]), "exact_energy": -math.sqrt(1.25)}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--device", help="Explicit Braket device ARN from discovery")
    group.add_argument("--status")
    group.add_argument("--result")
    group.add_argument("--cancel")
    args = p.parse_args()
    if args.status or args.result or args.cancel:
        from braket.aws import AwsQuantumJob
        job = AwsQuantumJob(args.status or args.result or args.cancel)
        print(job.state())
        if args.result:
            if job.state() != "COMPLETED":
                raise SystemExit("Check again when completed")
            print(job.result())
        if args.cancel and input("Type CANCEL to stop the job; accrued charges remain: ") == "CANCEL":
            print(job.cancel())
            print("Also inspect/cancel outstanding quantum tasks in the Braket console.")
        return
    marker = Path("quantum-hybrid-submission.txt")
    if marker.exists():
        raise SystemExit("Existing submission marker: reconcile it in AWS before another intentional submission.")
    print(f"Device: {args.device}. Up to 18 tasks × 128 shots = 2304 shots, plus classical job compute and storage. Review AWS pricing first.")
    if input("Type SUBMIT to authorize this paid AWS workload: ") != "SUBMIT":
        raise SystemExit("Cancelled")
    from braket.jobs import hybrid_job
    from braket.jobs.config import StoppingCondition
    marker.write_text("SUBMITTING — reconcile in AWS if interrupted.\n", encoding="utf-8")
    run = hybrid_job(device=args.device, stopping_condition=StoppingCondition(maxRuntimeInSeconds=1800))(optimize)
    job = run()
    marker.write_text(job.arn + "\n", encoding="utf-8")
    print(job.arn)
    print("Use --status / --result / --cancel with this ARN. The 30-minute job runtime limit is not a cost cap or a QPU task cancellation guarantee.")


if __name__ == "__main__":
    main()
