import { cron } from "../src/lib/cron";
import { db } from "../src/lib/db";
async function main() {
  console.log(await cron());
  await db().end();
}
main().catch((e) => {
  console.error("Ingestion failed:", e.code ?? e.name);
  process.exitCode = 1;
});
