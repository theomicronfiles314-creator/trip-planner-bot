# Trip Planner Bot

Bot de Telegram que actúa como asistente personal de planificación de viajes: alojamiento, coche de alquiler y vuelos, comparando varias webs y permitiendo iterar la búsqueda con botones. 100% gratuito — sin APIs de pago ni LLMs en la nube.

Estado actual: **esqueleto del proyecto + capa de NLP + módulo de alojamiento (scrapers de Booking.com y Airbnb en paralelo, combinados en un único ranking) funcionando de principio a fin.** Coche de alquiler, vuelos y la mini-app (Telegram Web App) llegarán en próximas entregas.

## Stack

- Node.js + TypeScript (ESM, `strict` activado)
- [grammy](https://grammy.dev) para el bot de Telegram
- [Playwright](https://playwright.dev) para el scraping (Booking.com y Airbnb, en paralelo)
- `node:sqlite` (módulo nativo de Node, sin compilación) como base de datos local
- [chrono-node](https://github.com/wanasit/chrono) + reglas propias en español para el parseo de lenguaje natural

> Nota sobre la base de datos: se usa el módulo experimental `node:sqlite` incluido en Node en vez de `better-sqlite3`, porque `better-sqlite3` requiere compilar código nativo (Visual Studio Build Tools en Windows) y a día de hoy no hay binario precompilado para Node 24. `node:sqlite` funciona igual sin ninguna instalación adicional. Requiere Node ≥ 22.5.

## Instalación

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Instala el navegador Chromium que usa Playwright para el scraping (solo la primera vez, ~300 MB):

   ```bash
   npx playwright install chromium
   ```

3. Copia `.env.example` a `.env` y rellena los valores (el token de bot ya debería estar puesto si seguiste la conversación inicial):

   ```bash
   cp .env.example .env
   ```

   Variables:
   - `TELEGRAM_BOT_TOKEN`: token de tu bot, obtenido hablando con [@BotFather](https://t.me/BotFather) en Telegram (`/newbot`).
   - `DB_PATH`: ruta del fichero SQLite (por defecto `./data/trip-planner.sqlite`, se crea solo).
   - `CACHE_TTL_HORAS`: horas que se cachea una búsqueda de alojamiento (por defecto 6).
   - `WEBAPP_PORT`, `WEBAPP_BASE_URL`: reservadas para la mini-app (Telegram Web App), aún no implementada.
   - `OLLAMA_URL`, `OLLAMA_MODEL`: reservadas para el módulo de coche de alquiler (resumen de letra pequeña con LLM local). Ver más abajo.

4. Arranca el bot en modo desarrollo (recarga automática):

   ```bash
   npm run dev
   ```

   O compílalo y ejecútalo:

   ```bash
   npm run build
   npm start
   ```

5. Habla con tu bot en Telegram y escribe `/start`.

## Uso

Escribe en lenguaje natural, por ejemplo:

- `Viaje para dos personas del 21 al 23 de septiembre a Altea`
- `Alojamiento en Valencia del 5 al 8 de octubre, 4 personas, máximo 300€`

Si falta algún dato (fechas, destino, número de personas), el bot te lo pregunta antes de buscar. Tras un resultado puedes escribir o pulsar los botones:

- **⬅️ Más barato** — la opción con menor precio total
- **🔄 Otra opción** — siguiente opción del ranking calidad-precio
- **📋 Ver todas** — lista de las mejores 10 opciones (la vista visual con mapa llegará con la Telegram Web App)
- **❌ Cancelar** — cancela la búsqueda en curso

## Ollama (para el futuro módulo de coche de alquiler)

El módulo de coche de alquiler usará un LLM local vía [Ollama](https://ollama.com) para resumir la letra pequeña (fianza, política de combustible, seguros, etc.) extraída por el scraper de DiscoverCars. No es necesario para el módulo de alojamiento actual, pero para tenerlo listo cuando llegue:

```bash
# Instala Ollama desde https://ollama.com/download
ollama pull llama3.1:8b
ollama serve
```

Por defecto el bot esperará Ollama en `http://localhost:11434` (configurable con `OLLAMA_URL`).

## Estructura del proyecto

```
src/
  bot/            grammy: sesión, comandos, handlers, botones, presentación en Telegram
  nlp/            parseo de mensajes libres a JSON estructurado (chrono-node + regex)
  modules/
    alojamiento/  scrapers de Booking y Airbnb (en paralelo), ranking calidad-precio combinado, orquestación + caché
  db/             esquema y acceso a SQLite (usuarios, búsquedas, caché)
  utils/          logger, gestión del navegador Playwright compartido
  config.ts       carga de variables de entorno
```

## Limitaciones conocidas (v1)

- Los scrapers dependen de la estructura HTML/DOM actual de cada web (selectores `data-testid` en Booking, atributos `itemprop` en Airbnb). Si alguna web cambia su estructura, ese scraper puede dejar de funcionar — revisa los logs (`[scraper:booking]` / `[scraper:airbnb]`) para diagnosticarlo. El otro scraper sigue funcionando de forma independiente (si uno falla, el bot avisa pero muestra igualmente los resultados de la otra plataforma).
- Sin API de afiliado, estas webs pueden mostrar CAPTCHA o bloquear peticiones repetidas desde la misma IP. El bot no falla por completo en ese caso: registra el error por plataforma y solo avisa de "no he podido encontrar resultados" si fallan **todas** las plataformas a la vez.
- Vrbo queda pendiente para una siguiente iteración (opcional según el enunciado original).
- La Telegram Web App ("Ver todas" con mapa y filtros) todavía no está implementada; de momento "Ver todas" envía un listado de texto.
