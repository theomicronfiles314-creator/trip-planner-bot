import type { Bot } from "grammy";
import type { BotContext } from "../session.js";
import { CB_MAS_BARATO, CB_OTRA_OPCION, CB_VER_TODAS, CB_CANCELAR } from "../keyboards.js";
import { accionMasBarato, accionOtraOpcion, accionVerTodas, accionCancelar } from "../acciones.js";

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
}
