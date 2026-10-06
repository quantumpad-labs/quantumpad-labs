"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import {
  ArrowUpRight,
  Download,
  Play,
  Square,
  Cpu,
  Sparkles,
} from "lucide-react";
import { PageHead } from "./terminal";
type Result = {
  kind: string;
  backend: string;
  elapsedMs: number;
  createdAt: string;
  size?: number;
  gflops?: number;
  checksum?: string;
  pixels?: number[];
  maxRelativeError?: number;
  prediction?: { label: string; score: number }[];
};
export function Playground() {
  const [mode, setMode] = useState<"matrix" | "sentiment">("matrix");
  const [backend, setBackend] = useState("cpu");
  const [size, setSize] = useState(256);
  const [text, setText] = useState(
    "I finally got my idea running. This is wonderful!",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    "Ready. Choose a workload and press Run.",
  );
  const [error, setError] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const worker = useRef<Worker | null>(null);
  const workerMode = useRef("");
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );
  useEffect(() => {
    if (!result?.pixels || !canvas.current) return;
    const ctx = canvas.current.getContext("2d");
    if (!ctx) return;
    const min = Math.min(...result.pixels),
      max = Math.max(...result.pixels);
    result.pixels.forEach((v, i) => {
      const t = (v - min) / Math.max(max - min, 1e-9);
      ctx.fillStyle = `rgb(${Math.round(22 + t * 198)},${Math.round(38 + t * 173)},${Math.round(62 + t * 98)})`;
      ctx.fillRect((i % 32) * 10, Math.floor(i / 32) * 10, 9, 9);
    });
  }, [result]);
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    workerMode.current = "";
    if (timeout.current) clearTimeout(timeout.current);
    setBusy(false);
    setStatus("Stopped. No cloud resource was created.");
  }
  function run() {
    if (busy) return;
    setBusy(true);
    setError(false);
    setResult(null);
    setStatus(
      mode === "matrix"
        ? "Executing matrix multiplication…"
        : "Preparing local inference. The first run downloads model files (~67 MB) from Hugging Face.",
    );
    try {
      if (!worker.current || workerMode.current !== mode) {
        worker.current?.terminate();
        worker.current = new Worker(
          mode === "matrix" ? "/lab/compute-worker.mjs" : "/lab/ai-worker.mjs",
          { type: "module" },
        );
        workerMode.current = mode;
      }
      worker.current.onmessage = ({ data }) => {
        if (data.type === "progress") {
          setStatus(data.message);
          return;
        }
        if (timeout.current) clearTimeout(timeout.current);
        setBusy(false);
        if (data.type === "error") {
          setError(true);
          setStatus(data.message);
          return;
        }
        setResult(data.result);
        setResults((prev) => [data.result, ...prev].slice(0, 10));
        setStatus("Complete. Results came from this device.");
      };
      worker.current.onerror = () => {
        if (timeout.current) clearTimeout(timeout.current);
        worker.current?.terminate();
        worker.current = null;
        setBusy(false);
        setError(true);
        setStatus(
          "The compute worker could not start. Reload or use another browser.",
        );
      };
      timeout.current = setTimeout(
        () => {
          stop();
          setError(true);
          setStatus(
            "Run timed out. Try a smaller workload or check your connection.",
          );
        },
        mode === "matrix" ? 30000 : 300000,
      );
      worker.current.postMessage({ size, backend, text });
    } catch {
      setBusy(false);
      setError(true);
      setStatus("This browser cannot create a compute worker.");
    }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              ...result,
              executionScope: "visitor-device",
              billing: "No cloud rental",
              verification:
                "Self-reported local execution; not a certified hardware benchmark.",
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "exaflop-local-result.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="page playground">
      <PageHead
        eyebrow="OPEN LAB / REAL EXECUTION"
        title="Press play. Meet your machine."
        description="Run real computation now. No account, wallet or cloud credit required."
        action={<span className="badge green">RUNS ON YOUR DEVICE</span>}
      />
      <div className="lab-layout">
        <section className="panel lab-controls">
          <div className="eyebrow">01 / CHOOSE A WORKLOAD</div>
          <div className="lab-tabs" role="group" aria-label="Workload">
            <button
              className={mode === "matrix" ? "selected" : ""}
              disabled={busy}
              onClick={() => {
                setMode("matrix");
                setResult(null);
              }}
            >
              <Cpu size={17} />
              Matrix lab
            </button>
            <button
              className={mode === "sentiment" ? "selected" : ""}
              disabled={busy}
              onClick={() => {
                setMode("sentiment");
                setResult(null);
              }}
            >
              <Sparkles size={17} />
              AI text analysis
            </button>
          </div>
          {mode === "matrix" ? (
            <>
              <h2>Multiply. Measure. Verify.</h2>
              <p>
                Multiply two dense matrices and check sampled outputs against an
                independent calculation.
              </p>
              <label>
                EXECUTION ENGINE
                <select
                  aria-label="Execution engine"
                  value={backend}
                  disabled={busy}
                  onChange={(e) => setBackend(e.target.value)}
                >
                  <option value="cpu">CPU / browser worker</option>
                  <option value="gpu">GPU / WebGPU</option>
                </select>
              </label>
              <label>
                MATRIX SIZE
                <select
                  aria-label="Matrix size"
                  disabled={busy}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                >
                  {[64, 128, 256, 512].map((n) => (
                    <option key={n} value={n}>
                      {n} × {n} · {((2 * n * n * n) / 1e6).toFixed(1)}M
                      operations
                    </option>
                  ))}
                </select>
              </label>
              <p className="footnote muted">
                WebGPU requires a compatible browser and adapter. Timings
                include dispatch overhead and are not comparable to vendor peak
                FLOPS.
              </p>
            </>
          ) : (
            <>
              <h2>A real model. Your words.</h2>
              <p>
                DistilBERT predicts positive or negative sentiment in English
                text. Text stays on your device.
              </p>
              <label>
                TEXT TO ANALYZE
                <textarea
                  aria-label="Text to analyze"
                  rows={5}
                  maxLength={2000}
                  disabled={busy}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <span className="muted footnote">
                {text.length} / 2,000 characters · Long inputs may be truncated
                by the model.
              </span>
              <p className="footnote muted">
                First run downloads ~67 MB plus the engine from Hugging Face and
                jsDelivr. Later runs can use the browser cache. Model
                predictions can be wrong.
              </p>
            </>
          )}
          <div className="lab-actions">
            <button
              className="button primary"
              disabled={busy || (mode === "sentiment" && !text.trim())}
              onClick={run}
            >
              <Play size={15} />
              {mode === "matrix" ? "Run computation" : "Run AI model"}
            </button>
            {busy && (
              <button className="button secondary" onClick={stop}>
                <Square size={14} />
                Stop
              </button>
            )}
          </div>
        </section>
        <section className="panel lab-output" aria-label="Execution results">
          <div className="section-heading">
            <span className="eyebrow">02 / EXECUTION OUTPUT</span>
            <span className={`badge ${busy ? "green" : ""}`}>
              {busy ? "RUNNING" : result ? "COMPLETED" : "IDLE"}
            </span>
          </div>
          <div
            className={`lab-status ${error ? "lab-error" : ""}`}
            role="status"
          >
            {status}
          </div>
          {result ? (
            <>
              <div className="lab-metrics">
                <div>
                  <span>ELAPSED</span>
                  <strong>
                    {result.elapsedMs.toFixed(2)}
                    <small>ms</small>
                  </strong>
                </div>
                <div>
                  <span>
                    {result.kind === "matrix"
                      ? "MEASURED THROUGHPUT"
                      : "TOP PREDICTION"}
                  </span>
                  <strong>
                    {result.kind === "matrix"
                      ? result.gflops?.toFixed(2)
                      : result.prediction?.[0]?.label}
                    <small>{result.kind === "matrix" ? "GFLOP/s" : ""}</small>
                  </strong>
                </div>
              </div>
              <p className="muted footnote">{result.backend}</p>
              {result.pixels && (
                <div className="lab-heatmap">
                  <canvas
                    ref={canvas}
                    width={320}
                    height={320}
                    aria-label="Heatmap sampled from the actual output matrix"
                  />
                  <div>
                    <b>Output matrix</b>
                    <p>32 × 32 sampled values, normalized to this run.</p>
                    <span className="badge green">4 OUTPUTS VERIFIED</span>
                    <p>
                      Maximum relative error:{" "}
                      {result.maxRelativeError?.toExponential(2)}
                    </p>
                  </div>
                </div>
              )}
              {result.prediction && (
                <div className="predictions">
                  {result.prediction.map((p) => (
                    <div key={p.label}>
                      <div>
                        <b>{p.label}</b>
                        <span>{(p.score * 100).toFixed(2)}%</span>
                      </div>
                      <progress
                        max={1}
                        value={p.score}
                        aria-label={`${p.label} model score`}
                      />
                    </div>
                  ))}
                </div>
              )}
              {result.checksum && (
                <p className="lab-checksum">
                  OUTPUT SHA-256
                  <br />
                  {result.checksum}
                </p>
              )}
              <button className="button secondary" onClick={download}>
                <Download size={14} />
                Download actual result
              </button>
            </>
          ) : (
            <div className="lab-idle">
              <div className="lab-glyph">A × B</div>
              <h3>
                {mode === "matrix"
                  ? "Your processor is the starting line."
                  : "Inference without an API key."}
              </h3>
              <p>Start a run to see measured output here.</p>
            </div>
          )}
        </section>
      </div>
      {results.length > 0 && (
        <section className="panel lab-history">
          <div className="section-heading">
            <h2>This session</h2>
            <span className="muted">Last 10 runs · memory only</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>WORKLOAD</th>
                  <th>ENGINE</th>
                  <th>TIME</th>
                  <th>FINISHED</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.createdAt + i}>
                    <td>
                      {r.kind === "matrix"
                        ? `${r.size} × ${r.size}`
                        : "Sentiment analysis"}
                    </td>
                    <td>{r.backend}</td>
                    <td>{r.elapsedMs.toFixed(2)} ms</td>
                    <td>{new Date(r.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel cloud-launch">
        <span className="eyebrow">03 / TAKE IT FURTHER</span>
        <h2>Ready for a cloud GPU?</h2>
        <p>
          Use the same matrix experiment in a Python notebook, or rent a machine
          through your provider account.
        </p>
        <div className="cloud-destinations">
          <div>
            <h3>Try a cloud notebook</h3>
            <p>
              Download the notebook, open Colab and choose File → Upload
              notebook. Run the cells. CPU works; GPU access depends on your
              Google account’s quota and availability.
            </p>
            <div className="lab-actions">
              <a
                className="text-link"
                href="/downloads/exaflop-lab.ipynb"
                download
              >
                Download notebook ↓
              </a>
              <a
                className="text-link"
                href="https://colab.research.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                <BrandLogo brand="googlecolab" compact/> Open Colab ↗
              </a>
            </div>
          </div>
          <Link href="/build">
            <h3>
              Rent dedicated compute <ArrowUpRight size={17} />
            </h3>
            <p>
              Configure hardware and launch with your funded Vast.ai account, or
              review a deployment in Runpod’s checkout.
            </p>
          </Link>
        </div>
        <p className="footnote muted">
          Browser results are local execution records. They are not cloud jobs,
          provider capacity, or certified performance measurements.{" "}
          <a
            href="https://huggingface.co/Xenova/distilbert-base-uncased-finetuned-sst-2-english"
            target="_blank"
            rel="noreferrer"
          >
            <BrandLogo brand="huggingface" compact/> Model details ↗
          </a>
        </p>
      </section>
    </div>
  );
}
