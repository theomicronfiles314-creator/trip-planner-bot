import { db } from "./db.js";

const stmtGet = db.prepare("SELECT valor FROM ajustes WHERE clave = ?");
const stmtSet = db.prepare(
  "INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor"
);

export function obtenerAjuste(clave: string): string | null {
  const fila = stmtGet.get(clave) as { valor: string } | undefined;
  return fila?.valor ?? null;
}

export function guardarAjuste(clave: string, valor: string): void {
  stmtSet.run(clave, valor);
}
