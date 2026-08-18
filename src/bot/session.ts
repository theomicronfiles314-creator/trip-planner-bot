import type { Context, SessionFlavor } from "grammy";
import type { BusquedaParseada } from "../nlp/types.js";
import type { AlojamientoResultado } from "../modules/alojamiento/types.js";

export interface BusquedaAlojamientoActiva {
  tipo: "alojamiento";
  destino: string;
  fechaInicio: string;
  fechaFin: string;
  personas: number;
  presupuestoMax?: number;
  resultados: AlojamientoResultado[];
  indiceActual: number;
  busquedaId: number | null;
}

export interface SessionData {
  /** Datos parciales acumulados mientras el bot pregunta lo que falta. */
  busquedaEnCurso: BusquedaParseada | null;
  /** Última búsqueda completada, para poder iterar con los botones. */
  ultimaBusqueda: BusquedaAlojamientoActiva | null;
}

export function estadoInicial(): SessionData {
  return {
    busquedaEnCurso: null,
    ultimaBusqueda: null,
  };
}

export type BotContext = Context & SessionFlavor<SessionData>;
