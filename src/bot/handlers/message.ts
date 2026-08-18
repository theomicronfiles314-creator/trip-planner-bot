import type { BotContext } from "../session.js";
import { asegurarUsuario } from "../../db/usuarios.js";
import { guardarBusqueda } from "../../db/busquedas.js";
import {
  parsearMensaje,
  combinarParseos,
  camposFaltantes,
  preguntaParaFaltantes,
  interpretarRespuestaDirecta,
} from "../../nlp/parser.js";
import { buscarAlojamiento } from "../../modules/alojamiento/service.js";
import { formatearResultadoAlojamiento } from "../presenters/alojamiento.js";
import { tecladoResultado } from "../keyboards.js";
import { accionMasBarato, accionOtraOpcion, accionVerTodas, accionCancelar } from "../acciones.js";
import { crearLogger } from "../../utils/logger.js";
import type { BusquedaAlojamientoActiva } from "../session.js";

const logger = crearLogger("bot:message");

const RE_CANCELAR = /^\s*(cancelar|cancela|para|stop)\s*$/i;
const RE_MAS_BARATO = /^\s*(más barato|mas barato|el más barato|el mas barato)\s*$/i;
const RE_OTRA_OPCION = /^\s*(otra opción|otra opcion|siguiente|otra)\s*$/i;
const RE_VER_TODAS = /^\s*(ver todas|todas|ver todo)\s*$/i;

export async function manejarMensaje(ctx: BotContext): Promise<void> {
  const texto = ctx.message?.text;
  if (!texto) return;
  if (ctx.from) asegurarUsuario(ctx.from.id, ctx.from.username);

  if (ctx.session.ultimaBusqueda) {
    if (RE_CANCELAR.test(texto)) return accionCancelar(ctx);
    if (RE_MAS_BARATO.test(texto)) return accionMasBarato(ctx, false);
    if (RE_OTRA_OPCION.test(texto)) return accionOtraOpcion(ctx, false);
    if (RE_VER_TODAS.test(texto)) return accionVerTodas(ctx);
  } else if (RE_CANCELAR.test(texto)) {
    return accionCancelar(ctx);
  }

  const faltabaAntes = ctx.session.busquedaEnCurso ? camposFaltantes(ctx.session.busquedaEnCurso) : [];

  const parseoNuevo = parsearMensaje(texto);
  let parseoCombinado = ctx.session.busquedaEnCurso
    ? combinarParseos(ctx.session.busquedaEnCurso, parseoNuevo)
    : parseoNuevo;

  // Si el bot solo había preguntado por un dato y el parseo normal no lo ha
  // rellenado, interpretamos el mensaje completo como respuesta directa a esa
  // pregunta (p.ej. "Cuenca" en respuesta a "¿me dices el destino?"), para no
  // quedarnos repitiendo la misma pregunta en bucle.
  if (faltabaAntes.length === 1) {
    const campo = faltabaAntes[0]!;
    if (camposFaltantes(parseoCombinado).includes(campo)) {
      const directo = interpretarRespuestaDirecta(campo, texto);
      if (directo) parseoCombinado = { ...parseoCombinado, ...directo };
    }
  }

  const faltan = camposFaltantes(parseoCombinado);

  if (faltan.length > 0) {
    ctx.session.busquedaEnCurso = parseoCombinado;
    await ctx.reply(preguntaParaFaltantes(faltan));
    return;
  }

  ctx.session.busquedaEnCurso = null;

  if (parseoCombinado.tipo === "coche" || parseoCombinado.tipo === "vuelos") {
    await ctx.reply(
      `He entendido tu búsqueda de ${parseoCombinado.tipo === "coche" ? "coche de alquiler" : "vuelos"}, ` +
        `pero ese módulo todavía no está implementado (llega en la próxima entrega). ` +
        `Por ahora puedo ayudarte con alojamiento 🏨`
    );
    return;
  }

  // A partir de aquí, tipo === "alojamiento" con todos los datos obligatorios presentes.
  const destino = parseoCombinado.destino!;
  const fechaInicio = parseoCombinado.fechaInicio!;
  const fechaFin = parseoCombinado.fechaFin!;
  const personas = parseoCombinado.personas!;
  const presupuestoMax = parseoCombinado.presupuesto ?? undefined;

  const avisoBusqueda = await ctx.reply(
    `🔎 Buscando alojamiento en ${destino} del ${fechaInicio} al ${fechaFin} en Booking, Airbnb, Hostelworld y Agoda... ` +
      `Puede tardar hasta un minuto, voy comparando las 4 plataformas a la vez.`
  );

  // Indicador de "escribiendo..." mientras dura la búsqueda: Telegram lo muestra
  // unos segundos y hay que repetirlo para que no desaparezca, así se ve que el
  // bot sigue trabajando y no se ha quedado colgado.
  const indicadorEscribiendo = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);
  ctx.replyWithChatAction("typing").catch(() => {});

  try {
    const { ranking, totalEncontrados, filtradoPorPresupuesto, fallaTecnica, fuentesConFallo } = await buscarAlojamiento({
      destino,
      fechaInicio,
      fechaFin,
      personas,
      ...(presupuestoMax !== undefined ? { presupuestoMax } : {}),
    });

    clearInterval(indicadorEscribiendo);
    await ctx.api.deleteMessage(avisoBusqueda.chat.id, avisoBusqueda.message_id).catch(() => {});

    if (ranking.length === 0) {
      let motivo: string;
      if (fallaTecnica) {
        motivo = "He tenido un problema técnico consultando las plataformas de alojamiento. Inténtalo de nuevo en unos minutos 🙏";
      } else if (filtradoPorPresupuesto) {
        motivo = `Encontré ${totalEncontrados} alojamientos pero ninguno dentro de tu presupuesto de ${presupuestoMax}€.`;
      } else {
        motivo = `No hay disponibilidad en ${destino} para esas fechas. Prueba con otras fechas u otro destino cercano.`;
      }
      await ctx.reply(`😕 ${motivo}`);
      return;
    }

    const usuarioId = ctx.from!.id;
    const busquedaId = guardarBusqueda(usuarioId, "alojamiento", { destino, fechaInicio, fechaFin, personas, presupuestoMax }, ranking);

    const activa: BusquedaAlojamientoActiva = {
      tipo: "alojamiento",
      destino,
      fechaInicio,
      fechaFin,
      personas,
      ...(presupuestoMax !== undefined ? { presupuestoMax } : {}),
      resultados: ranking,
      indiceActual: 0,
      busquedaId,
    };
    ctx.session.ultimaBusqueda = activa;

    if (fuentesConFallo.length > 0) {
      const nombres: Record<string, string> = { booking: "Booking.com", airbnb: "Airbnb", hostelworld: "Hostelworld", agoda: "Agoda" };
      const listado = fuentesConFallo.map((f) => nombres[f] ?? f).join(" y ");
      await ctx.reply(`⚠️ ${listado} no respondió esta vez; te muestro lo encontrado en el resto de plataformas.`);
    }

    const textoResultado = formatearResultadoAlojamiento(activa, 0);
    await ctx.reply(textoResultado, {
      parse_mode: "HTML",
      reply_markup: tecladoResultado(),
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    clearInterval(indicadorEscribiendo);
    logger.error("Error inesperado buscando alojamiento", error);
    await ctx.api.deleteMessage(avisoBusqueda.chat.id, avisoBusqueda.message_id).catch(() => {});
    await ctx.reply("Ha ocurrido un error buscando alojamiento. Inténtalo de nuevo en unos minutos 🙏");
  }
}
