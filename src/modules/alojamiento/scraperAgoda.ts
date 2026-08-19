import type { Page } from "playwright";
import { nuevoContexto, delayAleatorio } from "../../utils/playwright.js";
import { crearLogger } from "../../utils/logger.js";
import { extraerPaisDeDestino } from "./destino.js";
import type { AlojamientoResultado, ParametrosAlojamiento } from "./types.js";

const logger = crearLogger("scraper:agoda");
const MAX_RESULTADOS = 15;

function contarNoches(fechaInicio: string, fechaFin: string): number {
  const dias = (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(Math.round(dias), 1);
}

async function aceptarCookiesSiAparece(page: Page): Promise<void> {
  try {
    const boton = page.getByRole("button", { name: /aceptar|ok/i }).first();
    await boton.waitFor({ state: "visible", timeout: 4000 });
    await boton.click();
  } catch {
    // No apareció el banner de cookies, seguimos sin problema.
  }
}

/**
 * Agoda no acepta parámetros de ciudad en texto libre por URL: hace falta un `city` id interno
 * que solo se obtiene pasando por su buscador real (autocompletado + clic en la sugerencia),
 * igual que con Hostelworld. Se reutiliza la URL resultante, solo parcheando fechas/ocupación.
 */
async function resolverUrlBusqueda(page: Page, params: ParametrosAlojamiento): Promise<string | null> {
  await page.goto("https://www.agoda.com/es-es/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await aceptarCookiesSiAparece(page);
  await delayAleatorio();

  // El destino puede venir cualificado con país tras la desambiguación
  // (p.ej. "Cuenca, España"); a la caja de búsqueda solo le pasamos el nombre
  // de la ciudad, y usamos el país por separado para elegir la sugerencia correcta.
  const paisEsperado = extraerPaisDeDestino(params.destino);
  const nombreCiudad = params.destino.split(",")[0]!.trim();

  const input = page.locator("#textInput");
  await input.click({ timeout: 8000 });
  await page.keyboard.type(nombreCiudad, { delay: 60 });

  // El desplegable de Agoda mezcla sugerencias de distinto tipo (ciudad, zona,
  // aeropuerto, e incluso actividades) para el mismo texto. Nos interesan solo
  // las de formato "Ciudad, País" (así se distingue una entrada de ciudad real
  // de una de actividades tipo "Cuenca free tour").
  const candidatas = page.getByText(new RegExp(`^${escaparRegex(nombreCiudad)},\\s`, "i"));
  try {
    await candidatas.first().waitFor({ state: "visible", timeout: 8000 });
  } catch {
    // Sin sugerencias de tipo ciudad: Agoda no reconoce este destino.
    return null;
  }

  // Si el destino venía cualificado con un país concreto (nombres de ciudad
  // ambiguos entre países, p.ej. "Cuenca" en España vs. Ecuador), nos quedamos
  // con la sugerencia que lo mencione. Si ninguna coincide, tratamos el
  // destino como no cubierto en ese país. Sin país esperado, se usa la primera.
  let sugerenciaElegida = candidatas.first();
  if (paisEsperado) {
    const totalCandidatas = await candidatas.count();
    let encontrada = null;
    for (let i = 0; i < totalCandidatas; i++) {
      const texto = await candidatas.nth(i).innerText().catch(() => "");
      if (texto.toLowerCase().includes(paisEsperado.toLowerCase())) {
        encontrada = candidatas.nth(i);
        break;
      }
    }
    if (!encontrada) {
      logger.info(`Agoda no tiene ninguna sugerencia en ${paisEsperado} para destino=${params.destino}`);
      return null;
    }
    sugerenciaElegida = encontrada;
  }
  await sugerenciaElegida.click();
  await delayAleatorio();

  const botonBuscar = page.getByText(/^buscar$/i).first();
  await botonBuscar.click({ timeout: 8000 });
  // Si la sugerencia elegida era de un vertical distinto (actividades, vuelos...)
  // en vez de hoteles, la URL resultante no sería la de búsqueda de alojamiento.
  await page.waitForURL((url) => /\/search\?/.test(url.pathname + url.search) && !url.pathname.includes("/activities/"), {
    timeout: 20000,
  });

  const url = new URL(page.url());
  url.searchParams.set("checkIn", params.fechaInicio);
  url.searchParams.set("checkOut", params.fechaFin);
  url.searchParams.set("los", String(contarNoches(params.fechaInicio, params.fechaFin)));
  url.searchParams.set("adults", String(params.personas));
  url.searchParams.set("rooms", "1");
  return url.toString();
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsearRatingYReviews(texto: string): { rating: number | null; numeroReviews: number } {
  const match = texto.match(/(\d+[.,]\d+)[\s\S]{0,80}?([\d.,]+)\s*rese[nñ]as/i);
  if (!match?.[1]) return { rating: null, numeroReviews: 0 };
  const rating = Number.parseFloat(match[1].replace(",", "."));
  const numeroReviews = Number.parseInt((match[2] ?? "0").replace(/\./g, ""), 10);
  return {
    rating: Number.isFinite(rating) ? rating : null,
    numeroReviews: Number.isFinite(numeroReviews) ? numeroReviews : 0,
  };
}

/**
 * Agoda es la plataforma menos fiable de las cuatro (lista virtualizada, más
 * lenta y con timeouts intermitentes al navegar tras elegir la sugerencia,
 * incluso cuando la lógica es correcta). Un solo reintento con un contexto
 * nuevo suele bastar para que funcione, así que se prueba dos veces antes de
 * darlo por fallido de verdad.
 */
export async function buscarEnAgoda(params: ParametrosAlojamiento): Promise<AlojamientoResultado[] | null> {
  const primerIntento = await intentarBuscarEnAgoda(params);
  if (primerIntento !== null) return primerIntento;

  logger.warn(`Primer intento de Agoda fallido para destino=${params.destino}, reintentando una vez más`);
  return intentarBuscarEnAgoda(params);
}

/**
 * `null` = fallo técnico: no se debe cachear.
 * `[]` = búsqueda correcta (destino no reconocido por Agoda o sin disponibilidad): sí se debe cachear.
 */
async function intentarBuscarEnAgoda(params: ParametrosAlojamiento): Promise<AlojamientoResultado[] | null> {
  const noches = contarNoches(params.fechaInicio, params.fechaFin);
  const contexto = await nuevoContexto();
  const page = await contexto.newPage();

  try {
    const urlResultados = await resolverUrlBusqueda(page, params);
    if (urlResultados === null) {
      logger.info(`Agoda no tiene sugerencias para destino=${params.destino} (probablemente fuera de su catálogo)`);
      return [];
    }

    logger.info(`Buscando en Agoda: ${urlResultados}`);
    await page.goto(urlResultados, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delayAleatorio();

    await page.locator('li[data-hotelid]').first().waitFor({ timeout: 20000 }).catch(() => {});

    if ((await page.locator('li[data-hotelid]').count()) === 0) {
      logger.info(`Sin disponibilidad en Agoda para destino=${params.destino}, ${params.fechaInicio} a ${params.fechaFin}`);
      return [];
    }

    // La lista de Agoda está virtualizada: solo las tarjetas visibles en el viewport tienen
    // contenido real (el resto son <li> vacíos hasta que se hace scroll hasta ellos). Se hace
    // scroll progresivo, extrayendo en cada paso las tarjetas nuevas que ya estén renderizadas,
    // deduplicando por data-hotelid. `count()` (sin esperar) se usa para comprobar si el nombre
    // ya está renderizado, evitando pagar el timeout por defecto de Playwright en cada intento.
    const vistos = new Map<string, AlojamientoResultado>();
    let sinCambios = 0;

    for (let intento = 0; intento < 18 && vistos.size < MAX_RESULTADOS && sinCambios < 3; intento++) {
      const tarjetas = page.locator('li[data-hotelid]');
      const totalActual = await tarjetas.count();
      const antes = vistos.size;

      for (let i = 0; i < totalActual && vistos.size < MAX_RESULTADOS; i++) {
        const tarjeta = tarjetas.nth(i);
        const id = await tarjeta.getAttribute("data-hotelid").catch(() => null);
        if (!id || vistos.has(id)) continue;

        const nombreLoc = tarjeta.locator('[data-selenium="hotel-name"]');
        if ((await nombreLoc.count()) === 0) continue; // aún no renderizada

        try {
          // El nombre a veces incluye una segunda línea oculta (versión sin acentos, para
          // accesibilidad/SEO); nos quedamos solo con la primera línea visible.
          const nombre = (await nombreLoc.innerText()).split("\n")[0]!.trim();
          if (!nombre) continue;

          // "display-price" viene etiquetado como precio por noche ("Por noche después de gastos y tasas").
          const precioTexto = await tarjeta.locator('[data-selenium="display-price"]').innerText().catch(() => "");
          const precioPorNoche = Number.parseFloat(precioTexto.replace(/[^\d.,]/g, "").replace(",", "."));
          if (!Number.isFinite(precioPorNoche)) continue;

          const textoCompleto = await tarjeta.innerText().catch(() => "");
          const { rating, numeroReviews } = parsearRatingYReviews(textoCompleto);

          const distanciaTexto =
            (await tarjeta.locator('[data-selenium="popular-landmarks-text"]').innerText().catch(() => null)) ??
            (await tarjeta.locator('[data-selenium="area-city-text"]').innerText().catch(() => null));

          const fotoSrc = await tarjeta.locator("img").first().getAttribute("src").catch(() => null);
          const fotoUrl = fotoSrc ? new URL(fotoSrc, "https://www.agoda.com").toString() : null;

          const href = await tarjeta.locator("a").first().getAttribute("href").catch(() => null);
          const enlace = href ? new URL(href, "https://www.agoda.com").toString() : urlResultados;

          vistos.set(id, {
            fuente: "agoda",
            nombre,
            precioTotal: Math.round(precioPorNoche * noches * 100) / 100,
            precioPorNoche,
            moneda: "EUR",
            rating,
            ratingEscala: 10,
            numeroReviews,
            fotoUrl,
            distanciaTexto: distanciaTexto?.trim() || null,
            url: enlace,
          });
        } catch (errorTarjeta) {
          logger.warn(`No se pudo procesar una tarjeta de Agoda (id ${id}), se omite`, errorTarjeta);
        }
      }

      sinCambios = vistos.size === antes ? sinCambios + 1 : 0;
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(900);
    }

    const resultados = Array.from(vistos.values());
    logger.info(`Agoda devolvió ${resultados.length} resultados válidos`);
    return resultados;
  } catch (error) {
    logger.error("Fallo al scrapear Agoda (la web puede haber cambiado su estructura o bloqueado la petición)", error);
    return null;
  } finally {
    await page.close().catch(() => {});
    await contexto.close().catch(() => {});
  }
}
