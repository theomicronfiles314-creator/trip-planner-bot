import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { crearLogger } from "../utils/logger.js";

const logger = crearLogger("db");
const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
// Journal por defecto (no WAL): así todo el estado vive en un único archivo
// .sqlite, sin -wal/-shm sueltos, que es lo que el workflow de GitHub Actions
// comitea de vuelta al repo para persistir entre ejecuciones.
db.exec("PRAGMA foreign_keys = ON");

function migrar(): void {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  logger.info(`Base de datos lista en ${config.dbPath}`);
}

migrar();
