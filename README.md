# Trip Planner Bot

Bot de Telegram que actúa como asistente personal de planificación de viajes: alojamiento, coche de alquiler y vuelos, comparando varias webs y permitiendo iterar la búsqueda con botones. 100% gratuito — sin APIs de pago ni LLMs en la nube.

Estado actual: **esqueleto del proyecto + capa de NLP + módulo de alojamiento (scrapers de Booking.com, Airbnb, Hostelworld y Agoda en paralelo, combinados en un único ranking) funcionando de principio a fin, con despliegue 24/7 gratuito vía GitHub Actions.** Coche de alquiler, vuelos y la mini-app (Telegram Web App) llegarán en próximas entregas.

## Stack

- Node.js + TypeScript (ESM, `strict` activado)
- [grammy](https://grammy.dev) para el bot de Telegram
- [Playwright](https://playwright.dev) para el scraping (Booking.com, Airbnb, Hostelworld y Agoda, en paralelo)
- `node:sqlite` (módulo nativo de Node, sin compilación) como base de datos local — persiste sesión, caché y el offset de Telegram entre ejecuciones
- [chrono-node](https://github.com/wanasit/chrono) + reglas propias en español para el parseo de lenguaje natural
- GitHub Actions (cron) para correr el bot sin necesidad de ningún servidor ni ordenador encendido

> Vrbo y Expedia (mismo grupo) se descartaron: bloquean con un CAPTCHA ("¿Eres un robot?") desde el primer request, antes de mostrar ningún resultado.

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

## Despliegue 24/7 (sin servidor, gratis, vía GitHub Actions)

El proyecto tiene **dos modos de funcionamiento**:

- **`npm run dev` / `npm start`** (long polling continuo, `src/index.ts`): pensado para desarrollo local. El proceso queda escuchando indefinidamente y responde al instante. Requiere que el proceso siga vivo (tu ordenador encendido).
- **`npm run cycle`** (ciclo único, `src/cycle.ts`): pensado para producción. Consulta una vez si hay mensajes pendientes, los procesa y responde, y termina. Lo dispara automáticamente `.github/workflows/cycle.yml` cada 5 minutos mediante un cron de GitHub Actions — no hace falta ningún ordenador ni servidor encendido, todo corre en máquinas temporales de GitHub.

**Importante**: los dos modos no pueden usar el mismo token de bot a la vez (Telegram solo permite un consumidor de `getUpdates` activo). Si tienes el workflow de GitHub Actions activo, no dejes `npm run dev`/`npm start` corriendo en local contra el mismo bot — daría un error 409.

**Contrapartida del modo de ciclo**: las respuestas no son instantáneas. En el peor caso pueden tardar hasta 5-10 minutos (el cron de GitHub no garantiza puntualidad exacta), frente a la respuesta al momento del modo long-polling. Es el precio de no depender de ningún dispositivo propio encendido.

Cómo activarlo:

1. El repositorio debe ser **público** — GitHub Actions da minutos ilimitados gratis en repos públicos; en privados el plan gratuito son solo 2000 min/mes, que este workflow agotaría en pocos días al ejecutar Playwright cada 5 minutos.
2. Añade el token del bot como **GitHub Secret**: en el repo, `Settings → Secrets and variables → Actions → New repository secret`, nombre `TELEGRAM_BOT_TOKEN`. El valor nunca se guarda en el código ni aparece en los logs.
3. El workflow persiste la sesión, la caché y el offset de Telegram en `data/trip-planner.sqlite`, que **sí está versionado a propósito** (a diferencia de la mayoría de proyectos, ver comentario en `.gitignore`): cada ejecución de Actions arranca en una máquina nueva y vacía, así que el propio workflow hace commit de la base de datos actualizada al final de cada ciclo para que el estado sobreviva entre ejecuciones.
4. Para probarlo sin esperar al cron, ve a la pestaña **Actions** del repo → "Ciclo del bot de viajes" → "Run workflow".

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
  bot/            grammy: sesión (persistida en SQLite), comandos, handlers, botones, presentación en Telegram
  nlp/            parseo de mensajes libres a JSON estructurado (chrono-node + regex)
  modules/
    alojamiento/  scrapers de Booking, Airbnb, Hostelworld y Agoda (en paralelo), ranking calidad-precio combinado, orquestación + caché
  db/             esquema y acceso a SQLite (usuarios, búsquedas, caché, sesiones, ajustes)
  utils/          logger, gestión del navegador Playwright compartido
  index.ts        entrypoint de desarrollo (long polling continuo)
  cycle.ts        entrypoint de producción (ciclo único, usado por GitHub Actions)
  config.ts       carga de variables de entorno
.github/workflows/cycle.yml   cron que dispara src/cycle.ts cada 5 minutos
```

## Limitaciones conocidas (v1)

- Los scrapers dependen de la estructura HTML/DOM actual de cada web (selectores `data-testid` en Booking, atributos `itemprop` en Airbnb, clases CSS en Hostelworld, atributos `data-selenium` en Agoda). Si alguna web cambia su estructura, ese scraper puede dejar de funcionar — revisa los logs (`[scraper:booking]`, `[scraper:airbnb]`, `[scraper:hostelworld]`, `[scraper:agoda]`) para diagnosticarlo. Los demás scrapers siguen funcionando de forma independiente (si uno falla, el bot avisa pero muestra igualmente los resultados del resto).
- Sin API de afiliado, estas webs pueden mostrar CAPTCHA o bloquear peticiones repetidas desde la misma IP. El bot no falla por completo en ese caso: registra el error por plataforma y solo avisa de "no he podido encontrar resultados" si fallan **todas** las plataformas a la vez.
- Agoda usa una lista virtualizada (scroll infinito) y es la más lenta de las cuatro; normalmente devuelve entre 6 y 15 resultados según cuánto tiempo tarde en cargar.
- Vrbo y Expedia no son viables: bloquean con CAPTCHA desde el primer request (ver nota más arriba).
- En el modo de ciclo (GitHub Actions), las respuestas no son instantáneas — ver sección "Despliegue 24/7" más arriba.
- La Telegram Web App ("Ver todas" con mapa y filtros) todavía no está implementada; de momento "Ver todas" envía un listado de texto.
