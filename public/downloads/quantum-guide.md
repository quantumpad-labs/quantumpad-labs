# QuantumPad Quantum

Quantum Lab runs a bounded classical statevector simulator in the browser. It is not a QPU. Readout flips are independent measurement errors, not a calibrated hardware noise model.

## Local simulator

Use Python 3.12 in a virtual environment. Download exaflop-quantum.py and export quantum-request.json from the circuit lab into the same directory.

    python -m pip install qiskit qiskit-aer
    python exaflop-quantum.py run --provider local --request quantum-request.json

Import quantum-result.json in the circuit lab. The runner accepts 1–8 qubits, up to 64 gates and 8,192 shots. Bitstrings use q[n-1]...q0. Readout noise configured in the browser is not exported to provider requests.

## IBM Quantum

    python -m pip install qiskit qiskit-ibm-runtime

Set QISKIT_IBM_TOKEN and QISKIT_IBM_INSTANCE in your local environment using credentials from your IBM Quantum account. The instance is your instance CRN. Never commit these values or include them in shared files. The runner does not save credentials.

    python exaflop-quantum.py devices --provider ibm
    python exaflop-quantum.py run --provider ibm --backend BACKEND_NAME
    python exaflop-quantum.py status --receipt quantum-job.json
    python exaflop-quantum.py result --receipt quantum-job.json
    python exaflop-quantum.py cancel --receipt quantum-job.json

Choose BACKEND_NAME from devices.json. The runner transpiles to the device ISA and submits via SamplerV2. Explicit SUBMIT confirmation is required. Consult your plan, quotas and billing first. Poll status explicitly; result fetches only completed jobs. Import devices.json / quantum-result.json into the site. Imports are user-supplied snapshots, not independently verified attestations or live connections.

## Amazon Braket

    python -m pip install amazon-braket-sdk

Configure an AWS profile through the AWS SDK's standard credential chain and select an AWS region. Your account must have Braket access and appropriate IAM/S3 permissions; the runner does not grant them.

    python exaflop-quantum.py devices --provider braket
    python exaflop-quantum.py run --provider braket --backend DEVICE_ARN

Use the same status/result/cancel commands above. Select a compatible gate-based device, not an analog Hamiltonian device. Braket shots are normalized from measured-qubit order to q[n-1]...q0. Provider pricing and availability must be checked in AWS. Discovery does not submit a paid quantum task.

## Submission safety

Cloud submissions are never automatically retried. A SUBMITTING receipt is written before dispatch. If there is an error and no job ID, inspect the provider console: a job may have been created. Do not delete the receipt and rerun blindly. An existing receipt blocks accidental overwrite; use a unique --receipt filename only for an intentional new submission. Cancellation may not stop an already-executing task or refund incurred costs.

## GPU simulation

Use a supported Linux NVIDIA CUDA machine. The QuantumPad builder template prepares a CUDA Python environment; install the SDK after entering your machine using the provider's tools, then transfer your runner and request file.

    python -m pip install qiskit qiskit-aer-gpu
    python exaflop-quantum.py run --provider gpu

Do not install qiskit-aer and qiskit-aer-gpu together in one environment. GPU mode refuses a silent CPU fallback. The starter runner remains limited to 8 qubits; the planner illustrates larger memory requirements for researchers extending their own programs. GPU rental is classical compute billed by your provider; the template does not itself run a quantum circuit or expose a public notebook.

## Hybrid workflow

Download exaflop-hybrid.py. With Python 3.12, amazon-braket-sdk and an AWS profile:

    python exaflop-hybrid.py --device DEVICE_ARN
    python exaflop-hybrid.py --status JOB_ARN
    python exaflop-hybrid.py --result JOB_ARN
    python exaflop-hybrid.py --cancel JOB_ARN

This submits an AWS Hybrid Job doing a 9-angle VQE sweep for H=Z+0.5X, measuring Z and X separately at 128 shots each. At most 18 quantum tasks / 2,304 shots, plus classical instance and storage charges. The 1,800-second stopping condition limits job runtime, not cost or QPU queue duration; inspect outstanding quantum tasks if interrupted. The downloaded workflow is a starter integration, not a verified quantum advantage or production optimizer. Local UI examples use exact expectations and a denser grid, so results differ.

## Official references

- https://quantum.cloud.ibm.com/docs/en/api/qiskit-ibm-runtime/runtime-service
- https://quantum.cloud.ibm.com/docs/en/guides/plans-overview
- https://docs.aws.amazon.com/braket/latest/developerguide/what-is-braket.html
- https://docs.aws.amazon.com/braket/latest/developerguide/braket-hybrid-job-decorator.html
- https://qiskit.github.io/qiskit-aer/getting_started.html

Provider hardware execution requires your credentials and quota. QuantumPad's browser does not submit or track these external jobs in its GPU job ledger.
