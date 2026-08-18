import type { Page } from "playwright";
import { nuevoContexto, delayAleatorio } from "../../utils/playwright.js";
import { crearLogger } from "../../utils/logger.js";
import type { AlojamientoResultado, ParametrosAlojamiento } from "./types.js";

const logger = crearLogger("scraper:booking");
const MAX_RESULTADOS = 15;

function contarNoches(fechaInicio: string, fechaFin: string): number {
  const dias = (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(Math.round(dias), 1);
}

function construirUrl(params: ParametrosAlojamiento): string {
  const url = new URL("https://www.booking.com/searchresults.es.html");
  url.searchParams.set("ss", params.destino);
  url.searchParams.set("checkin", params.fechaInicio);
  url.searchParams.set("checkout", params.fechaFin);
  url.searchParams.set("group_adults", String(params.personas));
  url.searchParams.set("no_rooms", "1");
  url.searchParams.set("group_children", "0");
  url.searchParams.set("lang", "es");
  return url.toString();
}

async function aceptarCookiesSiAparece(page: Page): Promise<void> {
  try {
    const boton = page.locator("#onetrust-accept-btn-handler");
    await boton.waitFor({ state: "visible", timeout: 4000 });
    await boton.click();
  } catch {
    // No apareció el banner de cookies, seguimos sin problema.
  }
}

function parsearPrecio(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const numero = Number.parseFloat(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function parsearRating(texto: string): number | null {
  const match = texto.match(/(\d+[.,]\d+)/);
  if (!match?.[1]) return null;
  return Number.parseFloat(match[1].replace(",", "."));
}

function parsearNumeroReviews(texto: string): number {
  const match = texto.match(/([\d.,]+)\s*(?:comentarios|opiniones|reviews)/i);
  if (!match?.[1]) return 0;
  const limpio = match[1].replace(/\./g, "").replace(",", "");
  const numero = Number.parseInt(limpio, 10);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * `null` = fallo técnico (bloqueo, timeout real, cambio de estructura de la web): no se debe cachear.
 * `[]` = búsqueda correcta pero sin disponibilidad para esos criterios: sí se debe cachear.
 */
export async function buscarEnBooking(params: ParametrosAlojamiento): Promise<AlojamientoResultado[] | null> {
  const noches = contarNoches(params.fechaInicio, params.fechaFin);
  const url = construirUrl(params);
  const contexto = await nuevoContexto();
  const page = await contexto.newPage();

  try {
    logger.info(`Buscando en Booking: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await aceptarCookiesSiAparece(page);
    await delayAleatorio();

    // Esperamos a que aparezcan resultados o el aviso explícito de "sin disponibilidad";
    // si no aparece ninguno de los dos en el plazo, asumimos fallo técnico (bloqueo, web caída, etc.).
    await Promise.race([
      page.locator('[data-testid="property-card"]').first().waitFor({ timeout: 18000 }),
      page.getByText(/\b0\s+alojamientos?\s+disponibles?/i).first().waitFor({ timeout: 18000 }),
    ]);

    const tarjetas = page.locator('[data-testid="property-card"]');
    const total = Math.min(await tarjetas.count(), MAX_RESULTADOS);

    if (total === 0) {
      logger.info(`Sin disponibilidad en Booking para destino=${params.destino}, ${params.fechaInicio} a ${params.fechaFin}`);
      return [];
    }

    const resultados: AlojamientoResultado[] = [];

    for (let i = 0; i < total; i++) {
      const tarjeta = tarjetas.nth(i);
      try {
        // Timeout corto explícito en campos opcionales: evita esperar el timeout por defecto
        // de Playwright (30s) en cada tarjeta que no tenga un campo concreto.
        const T = { timeout: 3000 };

        const nombre = (await tarjeta.locator('[data-testid="title"]').innerText(T).catch(() => "")).trim();
        if (!nombre) continue;

        const precioTexto = await tarjeta
          .locator('[data-testid="price-and-discounted-price"]')
          .innerText(T)
          .catch(() => "");
        const precioTotal = parsearPrecio(precioTexto);
        if (precioTotal === null) continue;

        const bloqueReview = await tarjeta
          .locator('[data-testid="review-score"]')
          .innerText(T)
          .catch(() => "");
        const rating = parsearRating(bloqueReview);
        const numeroReviews = parsearNumeroReviews(bloqueReview);

        const fotoUrl = await tarjeta.locator("img").first().getAttribute("src", T).catch(() => null);

        const distanciaTexto = await tarjeta
          .locator('[data-testid="distance"]')
          .innerText(T)
          .catch(() => null);

        const href = await tarjeta.locator("a[data-testid='title-link']").first().getAttribute("href", T).catch(
          async () => tarjeta.locator("a").first().getAttribute("href", T)
        );
        const enlace = href ? new URL(href, "https://www.booking.com").toString() : url;

        resultados.push({
          fuente: "booking",
          nombre,
          precioTotal,
          precioPorNoche: Math.round((precioTotal / noches) * 100) / 100,
          moneda: "EUR",
          rating,
          ratingEscala: 10,
          numeroReviews,
          fotoUrl,
          distanciaTexto: distanciaTexto?.trim() || null,
          url: enlace,
        });
      } catch (errorTarjeta) {
        logger.warn(`No se pudo procesar una tarjeta de Booking (índice ${i}), se omite`, errorTarjeta);
      }
    }

    logger.info(`Booking devolvió ${resultados.length} resultados válidos`);
    return resultados;
  } catch (error) {
    logger.error("Fallo al scrapear Booking (la web puede haber cambiado su estructura o bloqueado la petición)", error);
    return null;
  } finally {
    await page.close().catch(() => {});
    await contexto.close().catch(() => {});
  }
}
