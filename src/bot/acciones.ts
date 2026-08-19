import { GrammyError } from "grammy";
import type { BotContext } from "./session.js";
import { tecladoResultado } from "./keyboards.js";
import { formatearResultadoAlojamiento, escaparHtml, ICONO_FUENTE } from "./presenters/alojamiento.js";
import { crearLogger } from "../utils/logger.js";

const logger = crearLogger("bot:acciones");

async function enviarOEditarResultado(ctx: BotContext, texto: string, esEdicion: boolean): Promise<void> {
  const opciones = { parse_mode: "HTML" as const, reply_markup: tecladoResultado(), link_preview_options: { is_disabled: true } };
  if (esEdicion) {
    try {
      await ctx.editMessageText(texto, opciones);
      return;
    } catch (error) {
      if (error instanceof GrammyError && error.description.includes("message is not modified")) {
        // Ya se estaba mostrando esta misma opción (p.ej. "más barato" pulsado dos veces seguidas): no hay nada que hacer.
        return;
      }
      logger.warn("No se pudo editar el mensaje, se envía uno nuevo", error);
    }
  }
  await ctx.reply(texto, opciones);
}

export async function accionMasBarato(ctx: BotContext, esEdicion: boolean): Promise<void> {
  const busqueda = ctx.session.ultimaBusqueda;
  if (!busqueda || busqueda.resultados.length === 0) {
    await ctx.reply("No tengo ninguna búsqueda activa. Cuéntame qué necesitas y buscamos de nuevo.");
    return;
  }

  let indiceMasBarato = 0;
  busqueda.resultados.forEach((r, i) => {
    if (r.precioTotal < busqueda.resultados[indiceMasBarato]!.precioTotal) indiceMasBarato = i;
  });

  busqueda.indiceActual = indiceMasBarato;
  const texto = formatearResultadoAlojamiento(busqueda, busqueda.indiceActual);
  await enviarOEditarResultado(ctx, texto, esEdicion);
}

export async function accionOtraOpcion(ctx: BotContext, esEdicion: boolean): Promise<void> {
  const busqueda = ctx.session.ultimaBusqueda;
  if (!busqueda || busqueda.resultados.length === 0) {
    await ctx.reply("No tengo ninguna búsqueda activa. Cuéntame qué necesitas y buscamos de nuevo.");
    return;
  }

  busqueda.indiceActual = (busqueda.indiceActual + 1) % busqueda.resultados.length;
  const texto = formatearResultadoAlojamiento(busqueda, busqueda.indiceActual);
  await enviarOEditarResultado(ctx, texto, esEdicion);
}

export async function accionVerTodas(ctx: BotContext): Promise<void> {
  const busqueda = ctx.session.ultimaBusqueda;
  if (!busqueda || busqueda.resultados.length === 0) {
    await ctx.reply("No tengo ninguna búsqueda activa. Cuéntame qué necesitas y buscamos de nuevo.");
    return;
  }

  const top = busqueda.resultados.slice(0, 10);
  const lineas = top.map(
    (r, i) =>
      `${i + 1}. ${ICONO_FUENTE[r.fuente]} ${escaparHtml(r.nombre)} — ${r.precioTotal.toFixed(0)} € total, ⭐ ${r.rating?.toFixed(1) ?? "s/v"} (${r.numeroReviews})`
  );

  await ctx.reply(
    `📋 <b>Todas las opciones (${top.length} de ${busqueda.resultados.length}):</b>\n\n${lineas.join("\n")}\n\n` +
      `La vista visual con fotos, filtros y mapa (Telegram Web App) llegará en una próxima entrega.`,
    { parse_mode: "HTML" }
  );
}

export async function accionCancelar(ctx: BotContext): Promise<void> {
  ctx.session.busquedaEnCurso = null;
  ctx.session.ultimaBusqueda = null;
  ctx.session.destinoPendiente = null;
  await ctx.reply("Búsqueda cancelada. Cuéntame cuándo quieras planear otro viaje 🧳");
}
