"use client";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { ArrowUpRight, Copy, Download } from "lucide-react";
import { useApp } from "./shell";
import type { Search } from "@/lib/types";

export function CloudLaunch({
  config,
  image,
  command,
}: {
  config: Search;
  image: string;
  command: string;
}) {
  const { notify } = useApp();
  const packet = {
    product: "QuantumPad",
    version: 1,
    hardware: config.hardware,
    gpuCount: config.quantity,
    requestedHours: config.durationHours,
    region: config.region,
    diskGb: config.disk,
    minRamGb: config.minRam,
    minCpu: config.minCpu,
    image,
    command,
    note: "Configuration request only, not a reservation. Confirm availability and final charges with the provider. Environment secrets are excluded. Terminate the rental in the provider console when finished.",
  };
  return (
    <section className="panel cloud-launch">
      <div>
        <span className="eyebrow">KEEP GOING / PROVIDER CHECKOUT</span>
        <h2>Your machine. Your cloud account.</h2>
        <p>
          Launch through a provider’s checkout with your own billing account, or
          connect Vast.ai for managed rentals inside QuantumPad.
        </p>
      </div>
      <div className="cloud-config">
        <strong>
          {config.quantity} × {config.hardware}
        </strong>
        <span>
          {config.disk} GB disk · {config.durationHours} h target
        </span>
        <code>{image}</code>
      </div>
      <div className="lab-actions">
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                JSON.stringify(packet, null, 2),
              );
              notify(
                "Configuration copied. Paste the values into your provider’s deployment form; secrets are excluded.",
              );
            } catch {
              notify(
                "Clipboard unavailable. Download the configuration instead.",
              );
            }
          }}
        >
          <Copy size={14} />
          Copy configuration
        </button>
        <button
          className="button secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(packet, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "exaflop-machine.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download size={14} />
          Download
        </button>
      </div>
      <div className="cloud-destinations">
        <a href="https://console.runpod.io/" target="_blank" rel="noreferrer">
          <b>
            <BrandLogo brand="runpod"/> Runpod <ArrowUpRight size={16} />
          </b>
          <span>
            Choose a Pod, paste your image and resources, review the complete
            price, then deploy.
          </span>
        </a>
        <a href="https://console.vast.ai/" target="_blank" rel="noreferrer">
          <b>
            <BrandLogo brand="vast"/> Vast.ai <ArrowUpRight size={16} />
          </b>
          <span>
            Select an offer and configure your container. Manage SSH, logs and
            billing in the console.
          </span>
        </a>
        <Link href="/settings#connect-provider">
          <b>
            Connect inside QuantumPad <ArrowUpRight size={16} />
          </b>
          <span>
            Encrypt your Vast.ai key, set your spending limits and launch from a
            live quote.
          </span>
        </Link>
      </div>
      <p className="muted footnote">
        Provider checkout opens a separate service. Configuration is copied
        manually; no capacity is reserved here. External rentals are managed and
        terminated there, and do not appear in QuantumPad jobs.
      </p>
    </section>
  );
}
