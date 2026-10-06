import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page empty">
      <span className="eyebrow">404 / OFF GRID</span>
      <h1>This node does not exist.</h1>
      <Link className="button primary" href="/markets">
        Return to markets ↗
      </Link>
    </div>
  );
}
