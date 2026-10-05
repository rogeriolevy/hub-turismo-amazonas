import { createRequire } from "node:module";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 22 || minor < 13) {
  console.error(
    `Este projeto requer Node.js 22.13.0 ou superior da linha 22. Atual: ${process.version}.`,
  );
  console.error(
    "Ative o Node 22 e reabra o terminal. Depois execute:\n" +
      "  npm rebuild better-sqlite3\n" +
      "  npm run check:runtime",
  );
  process.exit(1);
}

if (process.env.VERCEL) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error("Configure DATABASE_URL ou POSTGRES_URL para usar PostgreSQL na Vercel.");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Configure BLOB_READ_WRITE_TOKEN para armazenar imagens na Vercel.");
    process.exit(1);
  }
  console.log(`PostgreSQL configurado para funções Vercel com Node ${process.version}.`);
  process.exit(0);
}

const require = createRequire(import.meta.url);
let database;

try {
  const Database = require("better-sqlite3");
  database = new Database(":memory:");
  database.prepare("SELECT 1").get();
  console.log(`SQLite compatível com Node ${process.version} (ABI ${process.versions.modules}).`);
} catch (error) {
  console.error("Não foi possível carregar o módulo SQLite neste Node.js.");
  console.error(`Node ${process.version} (ABI ${process.versions.modules}): ${process.execPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    "\nPare o servidor com Ctrl+C e execute, no mesmo terminal:\n" +
      "  npm rebuild better-sqlite3\n" +
      "  npm run check:runtime\n" +
      "Se o problema persistir, reinstale as dependências com npm ci.\n" +
      "Use o Node.js 22 para instalar as dependências e iniciar o projeto.\n" +
      "Consulte docs/USO-LOCAL.md para mais detalhes.",
  );
  process.exitCode = 1;
} finally {
  database?.close();
}
