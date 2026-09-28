import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import "./sites-env.mjs";
function execute(sql, file) {
  const args = [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "dist/server/wrangler.json",
    "--persist-to",
    ".wrangler/state",
    "--json",
    ...(file ? ["--file", file] : ["--command", sql]),
  ];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
execute("CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL)");
const applied = execute("SELECT name, hash FROM local_migrations")[0].results;
for (const name of readdirSync("drizzle")
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  const hash = createHash("sha256")
    .update(readFileSync("drizzle/" + name))
    .digest("hex");
  const previous = applied.find((row) => row.name === name);
  if (previous) {
    if (previous.hash !== hash) throw new Error("Applied migration changed: " + name);
    continue;
  }
  if (process.argv[2] !== "--mark-applied") execute(null, "drizzle/" + name);
  execute(
    "INSERT INTO local_migrations (name, hash) VALUES ('" +
      name.replaceAll("'", "''") +
      "', '" +
      hash +
      "')",
  );
  console.log("Migration recorded:", name);
}
console.log("Local database ready.");
