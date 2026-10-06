import { inputs, multiply, verify } from "./compute.mjs";
self.onmessage = async ({ data }) => {
  let device;
  try {
    const n = data.size;
    const { a, b } = inputs(n);
    let output,
      elapsed,
      backend = "CPU · JavaScript worker";
    const totalStart = performance.now();
    if (data.backend === "gpu") {
      if (!navigator.gpu)
        throw new Error(
          "WebGPU is unavailable in this browser. Select CPU to run on this device.",
        );
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter)
        throw new Error("No WebGPU adapter is available. Select CPU instead.");
      device = await adapter.requestDevice();
      backend =
        "WebGPU · " +
        (adapter.info?.description ||
          adapter.info?.device ||
          "browser adapter");
      const size = a.byteLength;
      const buf = (usage) => device.createBuffer({ size, usage });
      const aa = buf(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST),
        bb = buf(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST),
        cc = buf(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC),
        read = buf(GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
      device.queue.writeBuffer(aa, 0, a);
      device.queue.writeBuffer(bb, 0, b);
      const module = device.createShaderModule({
        code: `@group(0) @binding(0) var<storage,read> a:array<f32>;@group(0) @binding(1) var<storage,read> b:array<f32>;@group(0) @binding(2) var<storage,read_write> c:array<f32>;@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.y;let col=id.x;if(row>=${n}u||col>=${n}u){return;}var sum:f32=0;for(var k:u32=0;k<${n}u;k=k+1){sum=sum+a[row*${n}u+k]*b[k*${n}u+col];}c[row*${n}u+col]=sum;}`,
      });
      const pipeline = await device.createComputePipelineAsync({
        layout: "auto",
        compute: { module, entryPoint: "main" },
      });
      const group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [aa, bb, cc].map((buffer, binding) => ({
          binding,
          resource: { buffer },
        })),
      });
      function submit() {
        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(Math.ceil(n / 8), Math.ceil(n / 8));
        pass.end();
        device.queue.submit([enc.finish()]);
      }
      submit();
      await device.queue.onSubmittedWorkDone();
      const start = performance.now();
      submit();
      await device.queue.onSubmittedWorkDone();
      elapsed = performance.now() - start;
      const copy = device.createCommandEncoder();
      copy.copyBufferToBuffer(cc, 0, read, 0, size);
      device.queue.submit([copy.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      output = new Float32Array(read.getMappedRange().slice(0));
      read.unmap();
    } else {
      const start = performance.now();
      output = multiply(a, b, n);
      elapsed = performance.now() - start;
    }
    const maxRelativeError = verify(a, b, output, n);
    const hash = await crypto.subtle.digest("SHA-256", output);
    const checksum = Array.from(new Uint8Array(hash), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    const pixels = Array.from(
      { length: 1024 },
      (_, i) =>
        output[
          Math.floor(i / 32) * Math.floor(n / 32) * n +
            (i % 32) * Math.floor(n / 32)
        ],
    );
    self.postMessage({
      type: "result",
      result: {
        kind: "matrix",
        backend,
        size: n,
        elapsedMs: elapsed,
        totalMs: performance.now() - totalStart,
        gflops: (2 * n * n * n) / (Math.max(elapsed, 0.001) * 1e6),
        maxRelativeError,
        checksum,
        pixels,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message || "Compute failed.",
    });
  } finally {
    device?.destroy();
  }
};
