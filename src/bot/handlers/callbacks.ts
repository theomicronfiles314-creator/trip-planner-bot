import type { Bot } from "grammy";
import type { BotContext } from "../session.js";
import { CB_MAS_BARATO, CB_OTRA_OPCION, CB_VER_TODAS, CB_CANCELAR } from "../keyboards.js";
import { accionMasBarato, accionOtraOpcion, accionVerTodas, accionCancelar } from "../acciones.js";
import { ejecutarBusquedaAlojamiento } from "./message.js";

export function registrarCallbacks(bot: Bot<BotContext>): void {
  bot.callbackQuery(CB_MAS_BARATO, async (ctx) => {
    await ctx.answerCallbackQuery();
    await accionMasBarato(ctx, true);
  });

  bot.callbackQuery(CB_OTRA_OPCION, async (ctx) => {
    await ctx.answerCallbackQuery();
    await accionOtraOpcion(ctx, true);
  });

  bot.callbackQuery(CB_VER_TODAS, async (ctx) => {
    await ctx.answerCallbackQuery();
    await accionVerTodas(ctx);
  });

  bot.callbackQuery(CB_CANCELAR, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup().catch(() => {});
    await accionCancelar(ctx);
  });

  bot.callbackQuery(/^destino:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup().catch(() => {});

    const indice = Number(ctx.match[1]);
    const pendiente = ctx.session.destinoPendiente;
    const candidato = pendiente?.candidatos[indice];

    if (!pendiente || !candidato) {
      await ctx.reply("Esa opción ya no está disponible. Cuéntame de nuevo qué necesitas y buscamos otra vez.");
      return;
    }

    ctx.session.destinoPendiente = null;
    await ejecutarBusquedaAlojamiento(ctx, { ...pendiente.parseo, destino: candidato.destinoCompleto });
  });
}
