import type { TipoBusqueda } from "./types.js";

const PALABRAS_VUELOS = /\b(vuelos?|volar|billetes? de avi[oó]n|avi[oó]n)\b/i;
const PALABRAS_COCHE = /\b(coche(s)? de alquiler|alquiler de coche(s)?|coche(s)?|furgoneta|rent\s*a\s*car)\b/i;
const PALABRAS_ALOJAMIENTO = /\b(alojamiento|hotel(es)?|apartamento(s)?|hospedaje|airbnb|d[oó]nde dormir|alojarme|quedarme|habitaci[oó]n)\b/i;

/**
 * Orden de prioridad: vuelos y coche tienen palabras clave más específicas
 * que "alojamiento" (que también puede inferirse de "viaje a X del ... al ...").
 */
export function detectarTipo(texto: string): TipoBusqueda | null {
  if (PALABRAS_VUELOS.test(texto)) return "vuelos";
  if (PALABRAS_COCHE.test(texto)) return "coche";
  if (PALABRAS_ALOJAMIENTO.test(texto)) return "alojamiento";

  // Heurística: "viaje [para N personas] a/en <destino> del X al Y" sin palabra
  // explícita se interpreta como búsqueda de alojamiento (caso de uso más común).
  if (/\bviaje\b/i.test(texto)) return "alojamiento";

  return null;
}
