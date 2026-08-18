import "./db/db.js";
import { crearBot } from "./bot/bot.js";
import { cerrarBrowserCompartido } from "./utils/playwright.js";
import { crearLogger } from "./utils/logger.js";

const logger = crearLogger("index");
const bot = crearBot();

async function apagar(señal: string): Promise<void> {
  logger.info(`Recibida señal ${señal}, apagando...`);
  await bot.stop();
  await cerrarBrowserCompartido();
  process.exit(0);
}

process.once("SIGINT", () => void apagar("SIGINT"));
process.once("SIGTERM", () => void apagar("SIGTERM"));

bot.start({
  onStart: (info) => logger.info(`Bot conectado como @${info.username}`),
});
