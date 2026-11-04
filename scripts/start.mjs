import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const onRender = process.env.RENDER === "true";
const autoMigrate = onRender || process.env.AUTO_MIGRATE === "true";

if (autoMigrate) {
  const migration =
    process.env.DATABASE_URL || process.env.POSTGRES_URL ? "migrate-postgres.ts" : "migrate.ts";
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", resolve(root, "scripts", migration)],
    { cwd: root, env: process.env, stdio: "inherit", windowsHide: true },
  );
  if (result.error) {
    console.error("Não foi possível preparar o banco antes de iniciar o Render:", result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const host = process.env.HOST || (onRender ? "0.0.0.0" : "127.0.0.1");
const port = process.env.PORT || "3005";
const standaloneServer = resolve(root, "server.js");
const useStandalone = process.env.NEXT_STANDALONE_SERVER === "true";
if (useStandalone && !existsSync(standaloneServer)) {
  console.error("O servidor Next.js standalone não está presente na imagem.");
  process.exit(1);
}
const nextCli = resolve(root, "node_modules", "next", "dist", "bin", "next");
const serverArguments = useStandalone
  ? [standaloneServer]
  : [nextCli, "start", "--hostname", host, "--port", port];
const child = spawn(process.execPath, serverArguments, {
  cwd: root,
  env: {
    ...process.env,
    ...(useStandalone ? { HOSTNAME: host, PORT: port } : {}),
  },
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;
const forwardSignal = (signal) => {
  stopping = true;
  child.kill(signal);
};
process.once("SIGINT", forwardSignal);
process.once("SIGTERM", forwardSignal);

child.on("error", (error) => {
  console.error("Não foi possível iniciar o servidor Next.js:", error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.removeListener("SIGINT", forwardSignal);
  process.removeListener("SIGTERM", forwardSignal);
  if (signal && !stopping) process.kill(process.pid, signal);
  else process.exitCode = code ?? 0;
});
