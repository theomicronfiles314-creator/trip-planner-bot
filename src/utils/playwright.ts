import { chromium, type Browser, type BrowserContext } from "playwright";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
];

function userAgentAleatorio(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

export function delayAleatorio(minMs = 400, maxMs = 1500): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let browserCompartido: Browser | null = null;

async function obtenerBrowser(): Promise<Browser> {
  if (!browserCompartido) {
    browserCompartido = await chromium.launch({ headless: true });
  }
  return browserCompartido;
}

export async function nuevoContexto(): Promise<BrowserContext> {
  const browser = await obtenerBrowser();
  return browser.newContext({
    userAgent: userAgentAleatorio(),
    locale: "es-ES",
    viewport: { width: 1366, height: 850 },
    timezoneId: "Europe/Madrid",
  });
}

export async function cerrarBrowserCompartido(): Promise<void> {
  if (browserCompartido) {
    await browserCompartido.close();
    browserCompartido = null;
  }
}
