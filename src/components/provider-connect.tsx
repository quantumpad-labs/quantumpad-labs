"use client";
import { BrandLogo } from "./brand-logo";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { api, useApp } from "./shell";

export function ProviderConnect() {
  const { owner, connect, notify } = useApp();
  const [items, setItems] = useState<{ id: string; provider: string }[]>([]);
  const [key, setKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setKey("");
    setItems([]);
    setConfirmed(false);
    if (owner)
      api("connections")
        .then((r) => setItems(r.connections))
        .catch((e) => notify(e.message));
  }, [owner, notify]);
  async function save() {
    setBusy(true);
    try {
      await api("connections", { provider: "vast", key, confirmed });
      setKey("");
      setConfirmed(false);
      setItems((await api("connections")).connections);
      notify(
        "Vast.ai connected. Your own account pays for rentals you explicitly launch.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel config-body" id="connect-provider">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT / YOUR COMPUTE</span>
          <h2>Connect Vast.ai. Start renting.</h2>
        </div>
        <KeyRound size={24} />
      </div>
      <p className="muted">
        Use your own funded provider account. QuantumPad encrypts your key and uses
        it only for your wallet’s offers and rentals. Connecting does not launch
        a machine. Job and daily limits below apply to every self-service
        launch.
      </p>
      {!owner ? (
        <button className="button primary" onClick={connect}>
          Sign in to connect a provider
        </button>
      ) : (
        <>
          {items.map((c) => (
            <div className="connection-row" key={c.id}>
              <b className="brand-inline"><BrandLogo brand="vast"/>Vast.ai</b>
              <span className="badge green">YOUR ACCOUNT CONNECTED</span>
              <Link href="/build?quantity=1&duration=1" className="text-link">
                Find a machine ↗
              </Link>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`connections/${c.id}`, undefined, "DELETE");
                    setItems([]);
                    notify("Provider key removed.");
                  } catch (e) {
                    notify((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Disconnect
              </button>
            </div>
          ))}
          <label>
            VAST.AI API KEY
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                items.length
                  ? "Paste a replacement key"
                  : "Paste your Vast.ai API key"
              }
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I own or am authorized to use this provider account. Rentals I
            confirm will bill this account.
          </label>
          <div className="lab-actions">
            <button
              className="button primary"
              disabled={busy || !confirmed || key.trim().length < 16}
              onClick={save}
            >
              {busy ? "Checking provider access…" : "Verify & connect"}
            </button>
            <a
              className="text-link"
              href="https://console.vast.ai/manage-keys/"
              target="_blank"
              rel="noreferrer"
            >
              Get a Vast.ai key <ArrowUpRight size={14} />
            </a>
          </div>
          <p className="muted footnote">
            Keys are never returned by the API. Stop active rentals before
            replacing or removing their key. Provider billing, bandwidth and
            data retention rules still apply.
          </p>
        </>
      )}
    </section>
  );
}
