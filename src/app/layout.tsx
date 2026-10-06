import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import "./earth.css";
import "./workspace.css";
import "./polish.css";
import "./quantum.css";
import "./launchpad.css";
import "./quantum-home.css";
import "./responsive.css";
export const metadata: Metadata = {
  title: {
    default: "QuantumPad — Quantum genesis token launchpad",
    template: "%s · QuantumPad",
  },
  description:
    "Launch tokens with a quantum experiment, software release or hybrid application. Publish a genesis record, trade integrated markets and build with QuantumPad’s quantum and compute tools.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head><link rel="preload" href="/fonts/SpaceGrotesk.ttf" as="font" type="font/ttf" crossOrigin="anonymous" /></head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
