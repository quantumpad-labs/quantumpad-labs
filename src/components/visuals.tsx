"use client";
export function Rack({
  quantity = 32,
  hero = false,
}: {
  quantity?: number;
  hero?: boolean;
}) {
  const racks = Math.min(12, Math.max(1, Math.ceil(quantity / 8)));
  return (
    <div
      className={`rack-scene ${hero ? "hero-rack" : ""}`}
      aria-label={`${quantity} GPUs, conceptual cluster visualization`}
    >
      <div className="floor-grid" />
      <div className="rack-array">
        {Array.from({ length: racks }, (_, r) => (
          <div
            className="rack"
            key={r}
            style={{ animationDelay: `${r * 65}ms` }}
          >
            <div className="rack-top" />
            <div className="rack-side" />
            <div className="rack-front">
              <div className="rack-brand">
                QuantumPad<span>●</span>
              </div>
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  className={`blade ${r * 8 + i < quantity ? "populated" : ""}`}
                  key={i}
                >
                  <i />
                  <div className="blade-vents" />
                  <span />
                  <span />
                </div>
              ))}
              <div className="rack-bottom">
                {String(r + 1).padStart(2, "0")}
                <span>COMPUTE NODE</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rack-caption">
        <span className="status-dot" />{" "}
        {hero
          ? "COMPUTE WITHOUT LIMITS"
          : `${quantity} GPUs · ${Math.ceil(quantity / 8)} planned nodes`}
        <small>CONCEPTUAL TOPOLOGY</small>
      </div>
    </div>
  );
}
export function HistoryChart({
  points,
}: {
  points: { timestamp: string; price: number | string }[];
}) {
  if (points.length < 2)
    return (
      <div className="chart-empty">
        <div className="chart-grid" />
        <div>
          <span className="tiny-cross">+</span>
          <strong>History starts with the first observation.</strong>
          <p>
            {points.length === 1
              ? "One snapshot collected. A second observation will unlock this chart."
              : "No historical prices have been collected yet."}
          </p>
        </div>
      </div>
    );
  const values = points.map((p) => Number(p.price));
  const min = Math.min(...values),
    max = Math.max(...values);
  const coords = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 1000},${180 - ((v - min) / (max - min || 1)) * 140}`,
    )
    .join(" ");
  return (
    <div className="history-chart">
      <div className="chart-scale">
        <span>${max.toFixed(2)}</span>
        <span>${min.toFixed(2)}</span>
      </div>
      <svg
        viewBox="0 0 1000 220"
        role="img"
        aria-label="Observed median price history"
      >
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#5ee2b5" stopOpacity=".18" />
            <stop offset="1" stopColor="#5ee2b5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 90, 140, 190].map((y) => (
          <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="#ffffff0b" />
        ))}
        <polygon points={`0,220 ${coords} 1000,220`} fill="url(#area)" />
        <polyline
          points={coords}
          fill="none"
          stroke="#5ee2b5"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="chart-dates">
        <span>{new Date(points[0].timestamp).toLocaleString()}</span>
        <span>{new Date(points.at(-1)!.timestamp).toLocaleString()}</span>
      </div>
    </div>
  );
}
