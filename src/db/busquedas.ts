import { db } from "./db.js";

export type TipoBusqueda = "alojamiento" | "coche" | "vuelos";

interface FilaBusqueda {
  id: number;
  usuario_id: number;
  tipo: string;
  parametros_json: string;
  resultados_json: string | null;
  timestamp: string;
}

const stmtInsert = db.prepare(
  `INSERT INTO busquedas (usuario_id, tipo, parametros_json, resultados_json)
   VALUES (?, ?, ?, ?)`
);

const stmtGetById = db.prepare("SELECT * FROM busquedas WHERE id = ?");

export function guardarBusqueda<TParams, TResultados>(
  usuarioId: number,
  tipo: TipoBusqueda,
  parametros: TParams,
  resultados: TResultados
): number {
  const info = stmtInsert.run(usuarioId, tipo, JSON.stringify(parametros), JSON.stringify(resultados));
  return Number(info.lastInsertRowid);
}

export function obtenerBusqueda(id: number) {
  const fila = stmtGetById.get(id) as FilaBusqueda | undefined;
  if (!fila) return null;
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    tipo: fila.tipo as TipoBusqueda,
    parametros: JSON.parse(fila.parametros_json),
    resultados: fila.resultados_json ? JSON.parse(fila.resultados_json) : null,
    timestamp: fila.timestamp,
  };
}
