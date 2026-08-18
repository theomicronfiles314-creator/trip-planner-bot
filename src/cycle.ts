import { db } from "./db/db.js";
import { obtenerAjuste, guardarAjuste } from "./db/ajustes.js";
import { crearBot } from "./bot/bot.js";
import { cerrarBrowserCompartido } from "./utils/playwright.js";
import { crearLogger } from "./utils/logger.js";

const logger = crearLogger("cycle");

const CLAVE_OFFSET = "telegram_offset";
const MAX_UPDATES_POR_CICLO = 30;

/**
 * Modo de ciclo único: en vez de long polling continuo (bot.start()), hace una
 * sola tanda de getUpdates, procesa lo pendiente y termina. Pensado para
 * ejecutarse desde un workflow de GitHub Actions disparado por cron, sin
 * necesidad de ningún servidor ni ordenador encendido de forma permanente.
 * El offset de Telegram y toda la sesión/caché quedan en el .sqlite, que el
 * propio workflow comitea de vuelta al repo al final de cada ciclo.
 */
async function ejecutarCiclo(): Promise<void> {
  const bot = crearBot();
  await bot.init();
  logger.info(`Bot inicializado como @${bot.botInfo.username}`);

  let offset = Number(obtenerAjuste(CLAVE_OFFSET) ?? "0");
  let procesados = 0;

  while (procesados < MAX_UPDATES_POR_CICLO) {
    const updates = await bot.api.getUpdates({
      offset,
      timeout: 0,
      allowed_updates: ["message", "callback_query"],
      limit: Math.min(30, MAX_UPDATES_POR_CICLO - procesados),
    });

    if (updates.length === 0) break;

    for (const update of updates) {
      try {
        await bot.handleUpdate(update);
      } catch (error) {
        logger.error(`Error procesando el update ${update.update_id}`, error);
      }
      offset = update.update_id + 1;
      guardarAjuste(CLAVE_OFFSET, String(offset));
      procesados++;
    }
  }

  logger.info(`Ciclo terminado: ${procesados} update(s) procesado(s)`);
}

ejecutarCiclo()
  .catch((error) => {
    logger.error("Fallo no controlado en el ciclo", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarBrowserCompartido();
    db.close();
    // Salida explícita: el cliente HTTP de grammy (u otro handle interno) puede
    // dejar el proceso vivo aunque el trabajo ya haya terminado. Sin esto, el
    // proceso se queda colgado indefinidamente en vez de salir solo.
    process.exit(process.exitCode ?? 0);
  });
