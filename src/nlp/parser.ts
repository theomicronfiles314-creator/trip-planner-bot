import { detectarTipo } from "./tipo.js";
import { extraerRangoFechas } from "./dates.js";
import { extraerDestino, extraerOrigenDestino } from "./destino.js";
import { extraerPersonas } from "./personas.js";
import { extraerPresupuesto } from "./presupuesto.js";
import { CAMPO_LABEL, type BusquedaParseada, type CampoFaltante } from "./types.js";

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
