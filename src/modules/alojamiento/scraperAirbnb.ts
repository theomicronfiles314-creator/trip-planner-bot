import type { Page } from "playwright";
import { nuevoContexto, delayAleatorio } from "../../utils/playwright.js";
import { crearLogger } from "../../utils/logger.js";
import { sesgarDestinoEspana } from "./destino.js";
import type { AlojamientoResultado, ParametrosAlojamiento } from "./types.js";

const logger = crearLogger("scraper:airbnb");
const MAX_RESULTADOS = 15;

function contarNoches(fechaInicio: string, fechaFin: string): number {
  const dias = (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(Math.round(dias), 1);
}

function construirUrl(params: ParametrosAlojamiento): string {
  const url = new URL(`https://www.airbnb.es/s/${encodeURIComponent(sesgarDestinoEspana(params.destino))}/homes`);
  url.searchParams.set("checkin", params.fechaInicio);
  url.searchParams.set("checkout", params.fechaFin);
  url.searchParams.set("adults", String(params.personas));
  return url.toString();
}

async function aceptarCookiesSiAparece(page: Page): Promise<void> {
  try {
    const boton = page.getByRole("button", { name: /aceptar|accept/i }).first();
    await boton.waitFor({ state: "visible", timeout: 4000 });
    await boton.click();
  } catch {
    // No apareció el banner de cookies, seguimos sin problema.
  }
}

function parsearPrecioTotal(texto: string): number | null {
  const match = texto.match(/([\d.,]+)\s*€\s*en total/i);
  if (!match?.[1]) return null;
  const limpio = match[1].replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const numero = Number.parseFloat(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function parsearRatingYReviews(texto: string): { rating: number | null; numeroReviews: number } {
  const match = texto.match(/Valoraci[oó]n media de\s*([\d.,]+)\s*sobre\s*5[.,]?.*?([\d.,]+)\s*evaluaciones?/is);
  if (!match?.[1]) return { rating: null, numeroReviews: 0 };
  const rating = Number.parseFloat(match[1].replace(",", "."));
  const numeroReviews = Number.parseInt((match[2] ?? "0").replace(/\./g, ""), 10);
  return {
    rating: Number.isFinite(rating) ? rating : null,
    numeroReviews: Number.isFinite(numeroReviews) ? numeroReviews : 0,
  };
}

/**
 * `null` = fallo técnico (bloqueo, timeout real, cambio de estructura de la web): no se debe cachear.
 * `[]` = búsqueda correcta pero sin disponibilidad para esos criterios: sí se debe cachear.
 */
export async function buscarEnAirbnb(params: ParametrosAlojamiento): Promise<AlojamientoResultado[] | null> {
  const noches = contarNoches(params.fechaInicio, params.fechaFin);
  const url = construirUrl(params);
  const contexto = await nuevoContexto();
  const page = await contexto.newPage();

  try {
    logger.info(`Buscando en Airbnb: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await aceptarCookiesSiAparece(page);
    await delayAleatorio();

    // Esperamos a que aparezcan tarjetas de resultado o el aviso de que no hay coincidencias.
    await Promise.race([
      page.locator('[itemprop="itemListElement"]').first().waitFor({ timeout: 18000 }),
      page.getByText(/no (hemos encontrado|hay) alojamientos?/i).first().waitFor({ timeout: 18000 }),
    ]);

    const tarjetas = page.locator('[itemprop="itemListElement"]');
    const total = Math.min(await tarjetas.count(), MAX_RESULTADOS);

    if (total === 0) {
      logger.info(`Sin disponibilidad en Airbnb para destino=${params.destino}, ${params.fechaInicio} a ${params.fechaFin}`);
      return [];
    }

    const resultados: AlojamientoResultado[] = [];

    for (let i = 0; i < total; i++) {
      const tarjeta = tarjetas.nth(i);
      try {
        // Timeout corto explícito en campos opcionales: evita esperar el timeout por defecto
        // de Playwright (30s) en cada tarjeta que no tenga un campo concreto.
        const T = { timeout: 3000 };

        const nombre = (await tarjeta.locator('meta[itemprop="name"]').getAttribute("content", T).catch(() => null))?.trim();
        if (!nombre) continue;

        const textoCompleto = await tarjeta.innerText(T).catch(() => "");

        const precioTotal = parsearPrecioTotal(textoCompleto);
        if (precioTotal === null) continue;

        const { rating, numeroReviews } = parsearRatingYReviews(textoCompleto);

        const fotoUrl = await tarjeta.locator("img").first().getAttribute("src", T).catch(() => null);

        const hrefRelativo = await tarjeta.locator('meta[itemprop="url"]').getAttribute("content", T).catch(() => null);
        const enlace = hrefRelativo ? new URL(hrefRelativo, "https://www.airbnb.es").toString() : url;

        resultados.push({
          fuente: "airbnb",
          nombre,
          precioTotal,
          precioPorNoche: Math.round((precioTotal / noches) * 100) / 100,
          moneda: "EUR",
          rating,
          ratingEscala: 5,
          numeroReviews,
          fotoUrl,
          distanciaTexto: null,
          url: enlace,
        });
      } catch (errorTarjeta) {
        logger.warn(`No se pudo procesar una tarjeta de Airbnb (índice ${i}), se omite`, errorTarjeta);
      }
    }

    logger.info(`Airbnb devolvió ${resultados.length} resultados válidos`);
    return resultados;
  } catch (error) {
    logger.error("Fallo al scrapear Airbnb (la web puede haber cambiado su estructura o bloqueado la petición)", error);
    return null;
  } finally {
    await page.close().catch(() => {});
    await contexto.close().catch(() => {});
  }
}
