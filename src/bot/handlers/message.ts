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
import type { BusquedaParseada } from "../../nlp/types.js";
import { buscarAlojamiento } from "../../modules/alojamiento/service.js";
import { buscarCandidatosDestino } from "../../modules/alojamiento/geocoding.js";
import { formatearResultadoAlojamiento } from "../presenters/alojamiento.js";
import { tecladoResultado, tecladoDesambiguacion } from "../keyboards.js";
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

  await procesarBusquedaCompleta(ctx, parseoCombinado);
}

/**
 * La búsqueda ya tiene todos los datos obligatorios. Antes de lanzar el
 * scraping comprueba si el destino es ambiguo entre países (p.ej. "Cuenca"
 * existe como ciudad relevante en España y en Ecuador).
 *
 * En el modo de ciclo único (GitHub Actions, cada 5 min) cada pregunta extra
 * cuesta un ciclo entero de espera, así que en vez de preguntar y bloquear la
 * búsqueda, se busca directamente con la coincidencia más relevante y se avisa
 * de las alternativas por si acaso — con botones para corregir sin tener que
 * volver a escribir todo, pero sin esperar a que el usuario responda.
 */
export async function procesarBusquedaCompleta(ctx: BotContext, parseo: BusquedaParseada): Promise<void> {
  let parseoFinal = parseo;
  const destino = parseo.destino!;

  // Si el destino ya viene cualificado con país (tras una desambiguación
  // previa, o porque el usuario ya lo escribió así, p.ej. "en Cuenca, Ecuador")
  // no hace falta volver a preguntar ni a adivinar.
  if (!destino.includes(",")) {
    const candidatos = await buscarCandidatosDestino(destino);

    if (candidatos.length >= 1) {
      parseoFinal = { ...parseo, destino: candidatos[0]!.destinoCompleto };
    }

    if (candidatos.length >= 2) {
      ctx.session.destinoPendiente = { parseo, candidatos };
      const alternativas = candidatos
        .slice(1)
        .map((c) => c.destinoCompleto)
        .join(" / ");
      await ctx.reply(
        `📍 "${destino}" también existe en otros sitios (${alternativas}). Voy a buscar en ` +
          `${candidatos[0]!.destinoCompleto} por ser la coincidencia más relevante — si querías otro, ` +
          `pulsa el botón o escríbelo con el país incluido y repito la búsqueda.`,
        { reply_markup: tecladoDesambiguacion(candidatos) }
      );
    }
    // Si no hay ningún candidato (Nominatim no lo reconoce, o falló la consulta),
    // seguimos con el destino tal cual lo escribió el usuario.
  }

  await ejecutarBusquedaAlojamiento(ctx, parseoFinal);
}

export async function ejecutarBusquedaAlojamiento(ctx: BotContext, parseo: BusquedaParseada): Promise<void> {
  const destino = parseo.destino!;
  const fechaInicio = parseo.fechaInicio!;
  const fechaFin = parseo.fechaFin!;
  const personas = parseo.personas!;
  const presupuestoMax = parseo.presupuesto ?? undefined;

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
