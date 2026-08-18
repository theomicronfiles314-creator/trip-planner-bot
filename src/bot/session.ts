import type { Context, SessionFlavor } from "grammy";
import type { BusquedaParseada } from "../nlp/types.js";
import type { AlojamientoResultado } from "../modules/alojamiento/types.js";
import type { CandidatoDestino } from "../modules/alojamiento/geocoding.js";

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

export interface DestinoPendiente {
  /** Búsqueda ya completa salvo por confirmar a qué país se refiere el destino. */
  parseo: BusquedaParseada;
  candidatos: CandidatoDestino[];
}

export interface SessionData {
  /** Datos parciales acumulados mientras el bot pregunta lo que falta. */
  busquedaEnCurso: BusquedaParseada | null;
  /** Última búsqueda completada, para poder iterar con los botones. */
  ultimaBusqueda: BusquedaAlojamientoActiva | null;
  /** Búsqueda completa esperando a que el usuario elija a qué país se refería. */
  destinoPendiente: DestinoPendiente | null;
}

export function estadoInicial(): SessionData {
  return {
    busquedaEnCurso: null,
    ultimaBusqueda: null,
    destinoPendiente: null,
  };
}

export type BotContext = Context & SessionFlavor<SessionData>;
