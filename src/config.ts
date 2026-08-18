import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env (usa .env.example como plantilla).`);
  }
  return value;
}

export const config = {
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  webappPort: Number(process.env["WEBAPP_PORT"] ?? 3000),
  webappBaseUrl: process.env["WEBAPP_BASE_URL"] ?? "http://localhost:3000",
  ollamaUrl: process.env["OLLAMA_URL"] ?? "http://localhost:11434",
  ollamaModel: process.env["OLLAMA_MODEL"] ?? "llama3.1:8b",
  dbPath: process.env["DB_PATH"] ?? "./data/trip-planner.sqlite",
  cacheTtlHoras: Number(process.env["CACHE_TTL_HORAS"] ?? 6),
};
