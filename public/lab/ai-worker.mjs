let classifier;
self.onmessage = async ({ data }) => {
  try {
    if (
      typeof data.text !== "string" ||
      !data.text.trim() ||
      data.text.length > 2000
    )
      throw new Error("Enter between 1 and 2,000 characters.");
    if (!classifier) {
      self.postMessage({
        type: "progress",
        message: "Loading inference engine…",
      });
      const { pipeline, env } = await import(
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1"
      );
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      classifier = await pipeline(
        "sentiment-analysis",
        "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
        {
          dtype: "q8",
          device: "wasm",
          progress_callback: (p) => {
            if (p.status === "progress")
              self.postMessage({
                type: "progress",
                message: `Loading ${p.file}: ${Math.round(p.progress ?? 0)}%`,
              });
          },
        },
      );
    }
    self.postMessage({
      type: "progress",
      message: "Running model on your device…",
    });
    const start = performance.now();
    const prediction = await classifier(data.text, {
      top_k: 2,
      truncation: true,
    });
    self.postMessage({
      type: "result",
      result: {
        kind: "sentiment",
        backend: "CPU · ONNX / WebAssembly",
        elapsedMs: performance.now() - start,
        prediction,
        createdAt: new Date().toISOString(),
        model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
      },
    });
  } catch (error) {
    classifier = undefined;
    self.postMessage({
      type: "error",
      message:
        error.message ||
        "The model could not load. Check your network and try again.",
    });
  }
};
