import type { AlojamientoResultado } from "../../modules/alojamiento/types.js";
import type { BusquedaAlojamientoActiva } from "../session.js";

function formatoRating(r: AlojamientoResultado): string {
  if (r.rating === null) return "Sin valoración";
  return `⭐ ${r.rating.toFixed(1)}/${r.ratingEscala} (${r.numeroReviews} reseñas)`;
}

export const ICONO_FUENTE: Record<AlojamientoResultado["fuente"], string> = {
  booking: "🏨",
  airbnb: "🏠",
  hostelworld: "🎒",
  agoda: "🛎️",
};

const NOMBRE_FUENTE: Record<AlojamientoResultado["fuente"], string> = {
  booking: "Booking.com",
  airbnb: "Airbnb",
  hostelworld: "Hostelworld",
  agoda: "Agoda",
};

export function formatearResultadoAlojamiento(
  busqueda: BusquedaAlojamientoActiva,
  posicion: number
): string {
  const resultado = busqueda.resultados[posicion];
  if (!resultado) {
    return "No hay más opciones disponibles para esta búsqueda.";
  }

  const noches = Math.max(
    Math.round(
      (new Date(busqueda.fechaFin).getTime() - new Date(busqueda.fechaInicio).getTime()) / (1000 * 60 * 60 * 24)
    ),
    1
  );

  const lineas = [
    `${ICONO_FUENTE[resultado.fuente]} <b>${escaparHtml(resultado.nombre)}</b>`,
    `<i>${NOMBRE_FUENTE[resultado.fuente]}</i>`,
    "",
    `💶 ${resultado.precioTotal.toFixed(0)} € total (${resultado.precioPorNoche.toFixed(0)} €/noche × ${noches} noches)`,
    formatoRating(resultado),
  ];

  if (resultado.distanciaTexto) {
    lineas.push(`📍 ${escaparHtml(resultado.distanciaTexto)}`);
  }

  lineas.push("", `🔗 <a href="${escaparHtml(resultado.url)}">Ver y reservar</a>`);
  lineas.push("", `Opción ${posicion + 1} de ${busqueda.resultados.length} · ${busqueda.destino}, ${busqueda.fechaInicio} → ${busqueda.fechaFin}`);

  return lineas.join("\n");
}

/**
 * Escapa caracteres especiales de HTML. Imprescindible para cualquier texto
 * dinámico (nombres de hotel, URLs) que se inserte en un mensaje con
 * parse_mode HTML: sin esto, un nombre con "&" (p.ej. "B&B Hotel", muy
 * habitual) hace que Telegram rechace el mensaje entero por HTML inválido.
 */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
