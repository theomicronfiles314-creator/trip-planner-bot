import { db } from "./db.js";
import { config } from "../config.js";
import { crearLogger } from "../utils/logger.js";

const logger = crearLogger("cache");

interface FilaCache {
  resultados_json: string;
  expira_en: string;
}

const stmtGet = db.prepare("SELECT resultados_json, expira_en FROM cache_resultados WHERE clave_busqueda = ?");
const stmtSet = db.prepare(
  `INSERT INTO cache_resultados (clave_busqueda, resultados_json, expira_en)
   VALUES (?, ?, ?)
   ON CONFLICT(clave_busqueda) DO UPDATE SET resultados_json = excluded.resultados_json, expira_en = excluded.expira_en`
);
const stmtDelete = db.prepare("DELETE FROM cache_resultados WHERE clave_busqueda = ?");

export function obtenerCache<T>(clave: string): T | null {
  const fila = stmtGet.get(clave) as FilaCache | undefined;
  if (!fila) return null;

  if (new Date(fila.expira_en).getTime() < Date.now()) {
    stmtDelete.run(clave);
    return null;
  }

  logger.debug(`Cache hit: ${clave}`);
  return JSON.parse(fila.resultados_json) as T;
}

export function guardarCache<T>(clave: string, resultados: T, ttlHoras = config.cacheTtlHoras): void {
  const expira = new Date(Date.now() + ttlHoras * 60 * 60 * 1000).toISOString();
  stmtSet.run(clave, JSON.stringify(resultados), expira);
  logger.debug(`Cache guardada: ${clave} (expira ${expira})`);
}

export function claveCacheAlojamiento(params: {
  destino: string;
  fechaInicio: string;
  fechaFin: string;
  personas: number;
}): string {
  return `alojamiento:${params.destino.toLowerCase().trim()}:${params.fechaInicio}:${params.fechaFin}:${params.personas}`;
}
