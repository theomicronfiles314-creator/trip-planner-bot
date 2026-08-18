import type { AlojamientoResultado } from "./types.js";

/** Pesos del algoritmo de calidad-precio. Ajustables sin tocar la lógica. */
export const PESO_RATING = 0.6;
export const PESO_REVIEWS = 0.4;

/** Por debajo de este número de reviews, el alojamiento se considera poco fiable. */
export const MIN_REVIEWS_FIABLE = 5;

/**
 * score = (rating_normalizado * peso_rating + reviews_normalizado * peso_reviews) / precio_normalizado
 *  - rating_normalizado: escala 0-10, convertida desde la escala original de cada web
 *  - reviews_normalizado: log(reviews) reescalado a 0-10 dentro del propio conjunto de resultados,
 *    para que 500 reviews no pesen 50x más que 10, pero sí más que unas pocas
 *  - precio_normalizado: precio/noche relativo al más barato del conjunto (el más barato = 1)
 */
export function calcularRanking(resultados: AlojamientoResultado[]): AlojamientoResultado[] {
  if (resultados.length === 0) return [];

  const fiables = resultados.filter((r) => r.numeroReviews >= MIN_REVIEWS_FIABLE);
  const candidatos = fiables.length > 0 ? fiables : resultados;

  const maxReviews = Math.max(...candidatos.map((r) => r.numeroReviews), 1);
  const minPrecioNoche = Math.max(
    Math.min(...candidatos.map((r) => r.precioPorNoche)),
    0.01
  );

  const puntuados = candidatos.map((r) => {
    const ratingNormalizado = r.rating !== null ? (r.rating / r.ratingEscala) * 10 : 0;
    const reviewsNormalizado = (Math.log(r.numeroReviews + 1) / Math.log(maxReviews + 1)) * 10;
    const precioNormalizado = r.precioPorNoche / minPrecioNoche;

    const score = (ratingNormalizado * PESO_RATING + reviewsNormalizado * PESO_REVIEWS) / precioNormalizado;

    return { ...r, score };
  });

  return puntuados.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
