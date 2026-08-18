import { Bot, session } from "grammy";
import { config } from "../config.js";
import { type BotContext, estadoInicial } from "./session.js";
import { manejarStart } from "./handlers/start.js";
import { manejarMensaje } from "./handlers/message.js";
import { registrarCallbacks } from "./handlers/callbacks.js";
import { crearLogger } from "../utils/logger.js";

const logger = crearLogger("bot");

export function crearBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegramBotToken);

  bot.use(session({ initial: estadoInicial }));

  bot.command("start", manejarStart);
  registrarCallbacks(bot);
  bot.on("message:text", manejarMensaje);

  bot.catch((err) => {
    logger.error(`Error no controlado para el update ${err.ctx.update.update_id}`, err.error);
  });

  return bot;
}
