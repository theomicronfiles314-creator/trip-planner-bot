import type { Page } from "playwright";
import { nuevoContexto, delayAleatorio } from "../../utils/playwright.js";
import { crearLogger } from "../../utils/logger.js";
import type { AlojamientoResultado, ParametrosAlojamiento } from "./types.js";

const logger = crearLogger("scraper:hostelworld");
const MAX_RESULTADOS = 15;

function contarNoches(fechaInicio: string, fechaFin: string): number {
  const dias = (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(Math.round(dias), 1);
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

/**
 * Hostelworld exige un id numérico de ciudad en la URL de resultados (no vale texto libre).
 * Se resuelve simulando la búsqueda real del sitio y reutilizando el id que la propia web
 * asigna al destino, en vez de intentar adivinar/llamar a su API interna de autocompletado
 * (protegida con una cabecera que no está expuesta fuera del bundle de la web).
 */
async function resolverUrlBusqueda(page: Page, params: ParametrosAlojamiento): Promise<string | null> {
  await page.goto("https://www.spanish.hostelworld.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await aceptarCookiesSiAparece(page);
  await delayAleatorio();

  const buscador = page.getByRole("textbox", { name: "¿Adónde quieres ir?" }).first();
  await buscador.click({ timeout: 8000 });
  await page.keyboard.type(params.destino, { delay: 60 });

  const candidatas = page.locator("li, [role='option']").filter({ hasText: params.destino });
  try {
    await candidatas.first().waitFor({ state: "visible", timeout: 8000 });
  } catch {
    // Sin sugerencias: Hostelworld no cubre este destino (esperable para pueblos pequeños,
    // ya que el catálogo son sobre todo hostales/albergues en ciudades y zonas turísticas).
    return null;
  }

  // Nombres de ciudad ambiguos entre países (p.ej. "Cuenca" en España vs.
  // Ecuador) pueden traer varias sugerencias: nos quedamos con la que
  // mencione España. Si ninguna la menciona, tratamos el destino como no
  // cubierto en España en vez de arriesgarnos a mostrar resultados de otro país.
  const totalCandidatas = await candidatas.count();
  let sugerenciaElegida = null;
  for (let i = 0; i < totalCandidatas; i++) {
    const texto = await candidatas.nth(i).innerText().catch(() => "");
    if (/españa/i.test(texto)) {
      sugerenciaElegida = candidatas.nth(i);
      break;
    }
  }
  if (!sugerenciaElegida) {
    logger.info(`Hostelworld no tiene ninguna sugerencia en España para destino=${params.destino}`);
    return null;
  }
  await sugerenciaElegida.click();

  const botonIr = page.getByText(/^¡vamos!$/i).first();
  await botonIr.click({ timeout: 8000 });
  await page.waitForURL(/\/pwa\/s\?/, { timeout: 15000 });

  const url = new URL(page.url());
  url.searchParams.set("from", params.fechaInicio);
  url.searchParams.set("to", params.fechaFin);
  url.searchParams.set("guests", String(params.personas));
  url.searchParams.set("page", "1");
  return url.toString();
}

/**
 * La lista de resultados de Hostelworld usa scroll infinito: solo las primeras tarjetas
 * (destacadas de pago) están en el DOM al cargar la página; el resto se añade al hacer scroll.
 */
async function cargarMasTarjetasConScroll(page: Page, objetivo: number): Promise<void> {
  const tarjetas = page.locator("a.property-card-container");
  for (let intento = 0; intento < 8; intento++) {
    const actual = await tarjetas.count();
    if (actual >= objetivo) return;
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(800);
    const despues = await tarjetas.count();
    if (despues === actual) return; // no cargaron más tras el scroll: hemos llegado al final
  }
}

function parsearReviews(texto: string): number {
  const match = texto.match(/\(([\d.,]+)\)/);
  if (!match?.[1]) return 0;
  const numero = Number.parseInt(match[1].replace(/[.,]/g, ""), 10);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * `null` = fallo técnico: no se debe cachear.
 * `[]` = búsqueda correcta (destino no cubierto por Hostelworld o sin disponibilidad): sí se debe cachear.
 */
export async function buscarEnHostelworld(params: ParametrosAlojamiento): Promise<AlojamientoResultado[] | null> {
  const noches = contarNoches(params.fechaInicio, params.fechaFin);
  const contexto = await nuevoContexto();
  const page = await contexto.newPage();

  try {
    const urlResultados = await resolverUrlBusqueda(page, params);
    if (urlResultados === null) {
      logger.info(`Hostelworld no tiene sugerencias para destino=${params.destino} (probablemente fuera de su catálogo)`);
      return [];
    }

    logger.info(`Buscando en Hostelworld: ${urlResultados}`);
    await page.goto(urlResultados, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delayAleatorio();

    await Promise.race([
      page.locator("a.property-card-container").first().waitFor({ timeout: 18000 }),
      page.getByText(/mostrando 0 propiedades/i).first().waitFor({ timeout: 18000 }),
    ]);

    await cargarMasTarjetasConScroll(page, MAX_RESULTADOS);

    const tarjetas = page.locator("a.property-card-container");
    const total = Math.min(await tarjetas.count(), MAX_RESULTADOS);

    if (total === 0) {
      logger.info(`Sin disponibilidad en Hostelworld para destino=${params.destino}, ${params.fechaInicio} a ${params.fechaFin}`);
      return [];
    }

    const resultados: AlojamientoResultado[] = [];

    for (let i = 0; i < total; i++) {
      const tarjeta = tarjetas.nth(i);
      try {
        // Timeout corto explícito en campos opcionales: evita esperar el timeout por defecto
        // de Playwright (30s) en cada tarjeta que no tenga un campo concreto.
        const T = { timeout: 3000 };

        const nombre = (await tarjeta.locator(".property-name").innerText(T).catch(() => "")).trim();
        if (!nombre) continue;

        // "pricefrom" es el precio del tipo de habitación/cama más barato disponible, mostrado
        // por noche (convención habitual de Hostelworld para hostales); se multiplica por las
        // noches de la estancia para obtener un total comparable con Booking/Airbnb.
        const precioAttr = await tarjeta.getAttribute("pricefrom", T).catch(() => null);
        const precioPorNoche = precioAttr ? Number.parseFloat(precioAttr.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
        if (precioPorNoche === null || !Number.isFinite(precioPorNoche)) continue;

        const textoRating = await tarjeta.locator(".property-rating").innerText(T).catch(() => "");
        const matchRating = textoRating.match(/(\d+[.,]\d+)/);
        const rating = matchRating?.[1] ? Number.parseFloat(matchRating[1].replace(",", ".")) : null;
        const numeroReviews = parsearReviews(textoRating);

        const fotoUrl = await tarjeta.getAttribute("image", T).catch(() => null);
        const distanciaTexto = await tarjeta.locator(".distance-description").innerText(T).catch(() => null);
        const href = await tarjeta.getAttribute("href", T).catch(() => null);

        resultados.push({
          fuente: "hostelworld",
          nombre,
          precioTotal: Math.round(precioPorNoche * noches * 100) / 100,
          precioPorNoche,
          moneda: "EUR",
          rating,
          ratingEscala: 10,
          numeroReviews,
          fotoUrl,
          distanciaTexto: distanciaTexto?.trim() || null,
          url: href ?? urlResultados,
        });
      } catch (errorTarjeta) {
        logger.warn(`No se pudo procesar una tarjeta de Hostelworld (índice ${i}), se omite`, errorTarjeta);
      }
    }

    logger.info(`Hostelworld devolvió ${resultados.length} resultados válidos`);
    return resultados;
  } catch (error) {
    logger.error("Fallo al scrapear Hostelworld (la web puede haber cambiado su estructura o bloqueado la petición)", error);
    return null;
  } finally {
    await page.close().catch(() => {});
    await contexto.close().catch(() => {});
  }
}
