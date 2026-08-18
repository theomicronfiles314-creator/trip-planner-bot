type Nivel = "info" | "warn" | "error" | "debug";

function timestamp(): string {
  return new Date().toISOString();
}

function log(nivel: Nivel, modulo: string, mensaje: string, extra?: unknown): void {
  const linea = `[${timestamp()}] [${nivel.toUpperCase()}] [${modulo}] ${mensaje}`;
  const consola = nivel === "error" ? console.error : nivel === "warn" ? console.warn : console.log;
  if (extra !== undefined) {
    consola(linea, extra);
  } else {
    consola(linea);
  }
}

export function crearLogger(modulo: string) {
  return {
    info: (mensaje: string, extra?: unknown) => log("info", modulo, mensaje, extra),
    warn: (mensaje: string, extra?: unknown) => log("warn", modulo, mensaje, extra),
    error: (mensaje: string, extra?: unknown) => log("error", modulo, mensaje, extra),
    debug: (mensaje: string, extra?: unknown) => log("debug", modulo, mensaje, extra),
  };
}

export type Logger = ReturnType<typeof crearLogger>;
