import { buscarEnBooking } from "./scraperBooking.js";
import { buscarEnAirbnb } from "./scraperAirbnb.js";
import { buscarEnHostelworld } from "./scraperHostelworld.js";
import { buscarEnAgoda } from "./scraperAgoda.js";
import { calcularRanking } from "./ranking.js";
import { obtenerCache, guardarCache, claveCacheAlojamiento } from "../../db/cache.js";
import { crearLogger } from "../../utils/logger.js";
import type { AlojamientoResultado, ParametrosAlojamiento } from "./types.js";

const logger = crearLogger("alojamiento:service");

type Fuente = AlojamientoResultado["fuente"];

const SCRAPERS: Record<Fuente, (params: ParametrosAlojamiento) => Promise<AlojamientoResultado[] | null>> = {
  booking: buscarEnBooking,
  airbnb: buscarEnAirbnb,
  hostelworld: buscarEnHostelworld,
  agoda: buscarEnAgoda,
};

export interface ResultadoBusquedaAlojamiento {
  ranking: AlojamientoResultado[];
  totalEncontrados: number;
  filtradoPorPresupuesto: boolean;
  /** true solo si TODAS las plataformas fallaron técnicamente (no hay ningún dato fiable que mostrar). */
  fallaTecnica: boolean;
  /** plataformas que fallaron técnicamente, para poder avisar aunque otras sí funcionaran. */
  fuentesConFallo: Fuente[];
}

interface ResultadosCrudos {
  resultados: AlojamientoResultado[];
  fuentesConFallo: Fuente[];
}

async function obtenerResultadosCrudos(params: ParametrosAlojamiento): Promise<ResultadosCrudos> {
  const clave = claveCacheAlojamiento(params);
  const cache = obtenerCache<AlojamientoResultado[]>(clave);
  if (cache) return { resultados: cache, fuentesConFallo: [] };

  const fuentes = Object.keys(SCRAPERS) as Fuente[];
  const resultadosPorFuente = await Promise.allSettled(
    fuentes.map((fuente) => SCRAPERS[fuente](params))
  );

  const combinados: AlojamientoResultado[] = [];
  const fuentesConFallo: Fuente[] = [];

  resultadosPorFuente.forEach((resultado, i) => {
    const fuente = fuentes[i]!;
    if (resultado.status === "rejected") {
      logger.error(`El scraper de ${fuente} lanzó una excepción no controlada`, resultado.reason);
      fuentesConFallo.push(fuente);
      return;
    }
    if (resultado.value === null) {
      fuentesConFallo.push(fuente);
      return;
    }
    combinados.push(...resultado.value);
  });

  // Solo cacheamos cuando al menos una plataforma respondió correctamente (aunque sea con 0 resultados);
  // si todas fallaron técnicamente no guardamos nada, para poder reintentar sin esperar el TTL.
  if (fuentesConFallo.length < fuentes.length) {
    guardarCache(clave, combinados);
  }

  return { resultados: combinados, fuentesConFallo };
}

export async function buscarAlojamiento(params: ParametrosAlojamiento): Promise<ResultadoBusquedaAlojamiento> {
  const { resultados: crudos, fuentesConFallo } = await obtenerResultadosCrudos(params);

  const dentroDePresupuesto = params.presupuestoMax
    ? crudos.filter((r) => r.precioTotal <= params.presupuestoMax!)
    : crudos;

  const ranking = calcularRanking(dentroDePresupuesto);
  const totalFuentes = Object.keys(SCRAPERS).length;

  return {
    ranking,
    totalEncontrados: crudos.length,
    filtradoPorPresupuesto: Boolean(params.presupuestoMax) && dentroDePresupuesto.length < crudos.length,
    fallaTecnica: fuentesConFallo.length === totalFuentes,
    fuentesConFallo,
  };
}
