import { db } from "./db";
import type { Market } from "./types";
export async function withChanges(markets: Market[]) {
  if (!process.env.DATABASE_URL) return markets;
  try {
    const past =
      await db()`with latest as (select hardware,max(observed_at) as timestamp from observations where observed_at<=now()-interval '24 hours' and observed_at>=now()-interval '26 hours' group by hardware) select o.hardware,percentile_cont(0.5) within group(order by o.price/o.gpu_count) as median from observations o join latest l on o.hardware=l.hardware and o.observed_at=l.timestamp where o.availability!='unavailable' group by o.hardware`;
    return markets.map((m) => {
      const baseline = Number(
        past.find((p) => p.hardware === m.hardware)?.median,
      );
      return {
        ...m,
        change24h:
          baseline > 0 && m.median !== null
            ? ((m.median - baseline) / baseline) * 100
            : null,
      };
    });
  } catch {
    return markets;
  }
}
