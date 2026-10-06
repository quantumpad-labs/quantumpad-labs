"use client";
import { useEffect, useState } from "react";
import { api, useApp } from "./shell";
export function WebhookPanel() {
  const { owner, notify } = useApp();
  const [hooks, setHooks] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () =>
    api("webhooks")
      .then((d) => setHooks(d.webhooks))
      .catch((e) => notify(e.message));
  useEffect(() => {
    if (owner) refresh();
  }, [owner]);
  if (!owner) return null;
  return (
    <section className="panel config-body">
      <div>
        <h2>Signed webhooks</h2>
        <p className="footnote muted">
          Receive job events at a public HTTPS endpoint. Delivery uses
          HMAC-SHA256, DNS pinning, encrypted signing secrets and up to five
          attempts. Requires the server encryption key and scheduler.
        </p>
      </div>
      <div className="inline-form">
        <input
          aria-label="Webhook endpoint"
          placeholder="https://your-service.example/exaflop/events"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="button primary"
          disabled={!url || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const h = await api("webhooks", {
                url,
                events: [
                  "job.started",
                  "job.completed",
                  "job.failed",
                  "job.stopped",
                  "quote.expired",
                  "spend.threshold",
                  "alert.triggered",
                ],
              });
              setSecret(h.secret);
              setUrl("");
              await refresh();
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Register endpoint
        </button>
      </div>
      {secret && (
        <div className="key-reveal">
          <b>Copy this signing secret once.</b>
          <code>{secret}</code>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(secret)
                .then(() => notify("Signing secret copied."))
            }
          >
            Copy
          </button>
          <button onClick={() => setSecret("")}>Dismiss</button>
        </div>
      )}
      {hooks.map((h) => (
        <div className="list-link" key={h.id}>
          <span className="address">{h.url}</span>
          <button
            onClick={async () => {
              try {
                await api(`webhooks/${h.id}`, undefined, "DELETE");
                await refresh();
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <pre>{`signature = HMAC_SHA256(secret, timestamp + "." + rawBody)\nX-Exaflop-Signature: v1=<hex>\nX-Exaflop-Timestamp: <Unix seconds>\n\nReject timestamps older than 5 minutes. Compare signatures in constant time.\nDeduplicate deliveries by the event id.`}</pre>
    </section>
  );
}
