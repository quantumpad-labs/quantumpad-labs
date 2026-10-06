import { readFile } from "node:fs/promises";
import { db } from "../src/lib/db";
async function main() {
  await db().unsafe(
    await readFile(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  await db().end();
  console.log("EXAFLOP schema ready.");
}
main().catch((e) => {
  console.error("Migration failed:", e.code ?? e.name);
  process.exitCode = 1;
});
