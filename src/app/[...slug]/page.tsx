import { Terminal } from "@/components/terminal";
import { notFound } from "next/navigation";
const routes = [
  "playground",
  "quantum",
  "launchpad",
  "markets",
  "build",
  "providers",
  "index",
  "compute-index",
  "arbitrage",
  "calculator",
  "estimator",
  "workloads",
  "jobs",
  "dashboard",
  "developers",
  "settings",
  "saved",
  "watchlist",
  "alerts",
];
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  if (
    slug.length > 2 ||
    (slug[0] && !routes.includes(slug[0])) ||
    (slug.length === 2 && !["markets", "providers", "jobs", "launchpad"].includes(slug[0]))
  )
    notFound();
  return <Terminal section={slug[0] === "compute-index" ? "index" : slug[0] ?? "home"} detail={slug[1]} />;
}
