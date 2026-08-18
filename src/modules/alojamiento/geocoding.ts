import { crearLogger } from "../../utils/logger.js";

const logger = crearLogger("geocoding");

// Solo asentamientos reales (no provincias/condados/estados, que generan
// falsos positivos de ambigüedad al duplicar el mismo país).
const TIPOS_ASENTAMIENTO = new Set(["city", "town", "village", "municipality", "hamlet"]);

// Por debajo de esto se considera ruido (pueblos homónimos poco relevantes,
// p.ej. una aldea perdida que comparte nombre con la ciudad que se busca).
const IMPORTANCIA_MINIMA = 0.45;

const MAX_CANDIDATOS = 3;

export interface CandidatoDestino {
  pais: string;
  /** Nombre completo listo para pasar a los scrapers, p.ej. "Cuenca, España". */
  destinoCompleto: string;
  /** Código ISO de 2 letras (p.ej. "es"), para mostrar la bandera en los botones. */
  codigoPais: string;
}

interface ResultadoNominatim {
  addresstype?: string;
  importance?: number;
  name?: string;
  address?: { country?: string; country_code?: string };
}

/** Convierte un código ISO de 2 letras (p.ej. "es") en su emoji de bandera. */
export function banderaDesdeCodigo(codigoPais: string): string {
  const codigo = codigoPais.toUpperCase();
  if (!/^[A-Z]{2}$/.test(codigo)) return "🌍";
  const puntos = [...codigo].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...puntos);
}

/**
 * Consulta Nominatim (OpenStreetMap, gratuito, sin API key) para averiguar en
 * qué país o países existe un destino con ese nombre. Se usa para detectar
 * ambigüedad ("Cuenca" existe como ciudad relevante tanto en España como en
 * Ecuador) sin depender de listas propias ni de adivinar según cada web.
 *
 * Devuelve como mucho un candidato por país, ordenados por relevancia. Si
 * Nominatim no responde o falla, devuelve un array vacío (el llamante debe
 * tratarlo igual que "no hay ambigüedad detectable" y seguir sin bloquear la
 * búsqueda).
 */
export async function buscarCandidatosDestino(destino: string): Promise<CandidatoDestino[]> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", destino);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");
    url.searchParams.set("accept-language", "es");

    const resp = await fetch(url, {
      headers: { "User-Agent": "trip-planner-bot/0.1 (bot de Telegram para uso personal)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];

    const datos = (await resp.json()) as ResultadoNominatim[];

    const mejorPorPais = new Map<string, { importancia: number; nombre: string; codigoPais: string }>();
    for (const item of datos) {
      const pais = item.address?.country;
      const codigoPais = item.address?.country_code;
      const importancia = item.importance ?? 0;
      if (!item.addresstype || !TIPOS_ASENTAMIENTO.has(item.addresstype)) continue;
      if (!pais || !codigoPais || importancia < IMPORTANCIA_MINIMA) continue;

      const actual = mejorPorPais.get(pais);
      if (!actual || importancia > actual.importancia) {
        mejorPorPais.set(pais, { importancia, nombre: item.name ?? destino, codigoPais });
      }
    }

    return Array.from(mejorPorPais.entries())
      .sort((a, b) => b[1].importancia - a[1].importancia)
      .slice(0, MAX_CANDIDATOS)
      .map(([pais, info]) => ({ pais, destinoCompleto: `${info.nombre}, ${pais}`, codigoPais: info.codigoPais }));
  } catch (error) {
    logger.warn(`No se pudo consultar Nominatim para desambiguar "${destino}"`, error);
    return [];
  }
}
