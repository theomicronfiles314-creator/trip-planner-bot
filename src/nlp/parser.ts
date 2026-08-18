import { detectarTipo } from "./tipo.js";
import { extraerRangoFechas } from "./dates.js";
import { extraerDestino, extraerOrigenDestino } from "./destino.js";
import { extraerPersonas } from "./personas.js";
import { extraerPresupuesto } from "./presupuesto.js";
import { CAMPO_LABEL, type BusquedaParseada, type CampoFaltante } from "./types.js";

const NUMEROS_TEXTO: Record<string, number> = {
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

export function parsearMensaje(texto: string, hoy: Date = new Date()): BusquedaParseada {
  const tipo = detectarTipo(texto);
  const rango = extraerRangoFechas(texto, hoy);
  const personas = extraerPersonas(texto);
  const presupuesto = extraerPresupuesto(texto);

  let destino: string | null = null;
  let origen: string | null = null;

  if (tipo === "vuelos") {
    const od = extraerOrigenDestino(texto);
    origen = od.origen;
    destino = od.destino ?? extraerDestino(texto);
  } else {
    destino = extraerDestino(texto);
  }

  return {
    tipo,
    destino,
    origen,
    fechaInicio: rango?.fechaInicio ?? null,
    fechaFin: rango?.fechaFin ?? null,
    personas,
    presupuesto,
  };
}

/** Combina un parseo nuevo (parcial) sobre uno existente, sin perder datos ya confirmados. */
export function combinarParseos(base: BusquedaParseada, nuevo: BusquedaParseada): BusquedaParseada {
  return {
    tipo: nuevo.tipo ?? base.tipo,
    destino: nuevo.destino ?? base.destino,
    origen: nuevo.origen ?? base.origen,
    fechaInicio: nuevo.fechaInicio ?? base.fechaInicio,
    fechaFin: nuevo.fechaFin ?? base.fechaFin,
    personas: nuevo.personas ?? base.personas,
    presupuesto: nuevo.presupuesto ?? base.presupuesto,
  };
}

export function camposFaltantes(parsed: BusquedaParseada): CampoFaltante[] {
  const faltan: CampoFaltante[] = [];
  if (!parsed.tipo) faltan.push("tipo");
  if (!parsed.destino) faltan.push("destino");
  if (parsed.tipo === "vuelos" && !parsed.origen) faltan.push("origen");
  if (!parsed.fechaInicio) faltan.push("fechaInicio");
  // La fecha de fin no es obligatoria en vuelos (billete solo ida).
  if (!parsed.fechaFin && parsed.tipo !== "vuelos") faltan.push("fechaFin");
  if (parsed.tipo !== "vuelos" && !parsed.personas) faltan.push("personas");
  return faltan;
}

/**
 * Cuando el bot ya ha preguntado por UN dato concreto, el usuario suele responder
 * con una frase corta y directa ("Cuenca", "2", "dos") que no encaja con los
 * patrones pensados para el mensaje libre inicial (que esperan "en Cuenca",
 * "2 personas", etc.). Esta función interpreta esa respuesta corta de forma más
 * permisiva para el campo concreto que se preguntó, evitando que el bot se quede
 * repitiendo la misma pregunta en bucle.
 */
export function interpretarRespuestaDirecta(
  campo: CampoFaltante,
  texto: string
): Partial<BusquedaParseada> | null {
  const limpio = texto.trim().replace(/[.!?¡¿]+$/g, "").trim();
  if (!limpio) return null;

  if (campo === "destino" || campo === "origen") {
    if (limpio.length > 60) return null; // probablemente no es una respuesta corta directa
    const capitalizado = limpio
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
    return campo === "destino" ? { destino: capitalizado } : { origen: capitalizado };
  }

  if (campo === "personas") {
    const match = limpio.match(new RegExp(`^(\\d{1,2}|${Object.keys(NUMEROS_TEXTO).join("|")})$`, "i"));
    if (!match?.[1]) return null;
    const numero = NUMEROS_TEXTO[match[1].toLowerCase()] ?? Number(match[1]);
    return numero > 0 ? { personas: numero } : null;
  }

  return null;
}

export function preguntaParaFaltantes(faltan: CampoFaltante[]): string {
  if (faltan.length === 0) return "";
  const etiquetas = faltan.map((campo) => CAMPO_LABEL[campo]);
  if (etiquetas.length === 1) {
    return `Me falta un dato: ¿me dices ${etiquetas[0]}?`;
  }
  const ultima = etiquetas[etiquetas.length - 1];
  const resto = etiquetas.slice(0, -1).join(", ");
  return `Me faltan algunos datos: ¿me dices ${resto} y ${ultima}?`;
}
