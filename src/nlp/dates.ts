import * as chrono from "chrono-node";

const MESES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const NOMBRE_MESES = Object.keys(MESES).join("|");

export interface RangoFechas {
  fechaInicio: string;
  fechaFin: string;
}

function soloFecha(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function aISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Si la fecha (con el año dado) ya pasó respecto a hoy, la empuja al año siguiente. */
function ajustarAnioSiPasado(fecha: Date, hoy: Date): Date {
  const ajustada = soloFecha(fecha);
  if (ajustada.getTime() < soloFecha(hoy).getTime()) {
    ajustada.setFullYear(ajustada.getFullYear() + 1);
  }
  return ajustada;
}

/**
 * Intenta extraer un rango de fechas de patrones habituales en español:
 * "del 21 al 23 de septiembre", "del 5 de octubre al 8 de noviembre",
 * "21 al 23 de septiembre", con o sin año explícito.
 */
function parseRangoConRegex(texto: string, hoy: Date): RangoFechas | null {
  // Patrón A: "del 21 al 23 de septiembre [de 2026]" (mismo mes)
  const patronA = new RegExp(
    `\\bdel?\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(${NOMBRE_MESES})(?:\\s+de\\s+(\\d{4}))?`,
    "i"
  );
  const matchA = texto.match(patronA);
  if (matchA) {
    const [, diaIni, diaFin, mesNombre, anio] = matchA;
    const mes = MESES[mesNombre!.toLowerCase()]!;
    const year = anio ? Number(anio) : hoy.getFullYear();
    let inicio = new Date(year, mes, Number(diaIni));
    let fin = new Date(year, mes, Number(diaFin));
    if (!anio) {
      inicio = ajustarAnioSiPasado(inicio, hoy);
      fin = new Date(inicio.getFullYear(), mes, Number(diaFin));
    }
    return { fechaInicio: aISO(inicio), fechaFin: aISO(fin) };
  }

  // Patrón B: "del 5 de octubre al 8 de noviembre [de 2026]" (meses distintos)
  const patronB = new RegExp(
    `\\bdel?\\s+(\\d{1,2})\\s+de\\s+(${NOMBRE_MESES})\\s+al\\s+(\\d{1,2})\\s+de\\s+(${NOMBRE_MESES})(?:\\s+de\\s+(\\d{4}))?`,
    "i"
  );
  const matchB = texto.match(patronB);
  if (matchB) {
    const [, diaIni, mesIniNombre, diaFin, mesFinNombre, anio] = matchB;
    const mesIni = MESES[mesIniNombre!.toLowerCase()]!;
    const mesFin = MESES[mesFinNombre!.toLowerCase()]!;
    const year = anio ? Number(anio) : hoy.getFullYear();
    let inicio = new Date(year, mesIni, Number(diaIni));
    let fin = new Date(year, mesFin, Number(diaFin));
    if (!anio) {
      inicio = ajustarAnioSiPasado(inicio, hoy);
      fin = new Date(inicio.getFullYear(), mesFin, Number(diaFin));
      if (fin.getTime() < inicio.getTime()) {
        fin.setFullYear(fin.getFullYear() + 1);
      }
    }
    return { fechaInicio: aISO(inicio), fechaFin: aISO(fin) };
  }

  return null;
}

function ultimoSabadoDelMes(anio: number, mes: number): Date {
  const ultimoDia = new Date(anio, mes + 1, 0);
  const offset = (ultimoDia.getDay() - 6 + 7) % 7;
  return new Date(anio, mes, ultimoDia.getDate() - offset);
}

function primerSabadoDelMes(anio: number, mes: number): Date {
  const primerDia = new Date(anio, mes, 1);
  const offset = (6 - primerDia.getDay() + 7) % 7;
  return new Date(anio, mes, 1 + offset);
}

function proximoSabado(desde: Date): Date {
  const offset = (6 - desde.getDay() + 7) % 7;
  return new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + offset);
}

/**
 * Reconoce expresiones de "fin de semana" habituales: "el último finde de agosto",
 * "el primer fin de semana de octubre", "este fin de semana", "el finde que viene".
 * El rango resultante es viernes → domingo (2 noches), la duración habitual de una escapada.
 */
function parseFinDeSemana(texto: string, hoy: Date): RangoFechas | null {
  const patron = new RegExp(
    `\\b(ultimo|último|pr[oó]ximo|primer)?\\s*(?:fin\\s+de\\s+semana|finde)(?:\\s+que\\s+viene)?(?:\\s+de\\s+(${NOMBRE_MESES}))?`,
    "i"
  );
  const match = texto.match(patron);
  if (!match) return null;

  const calificativoTexto = match[1]?.toLowerCase() ?? "";
  const esUltimo = calificativoTexto.startsWith("ultim") || calificativoTexto.startsWith("últim");
  const esPrimer = calificativoTexto.startsWith("primer");
  const mesNombre = match[2]?.toLowerCase();

  let sabado: Date;
  if (mesNombre) {
    const mes = MESES[mesNombre]!;
    const year = hoy.getFullYear();
    const calcular = (y: number) => (esPrimer && !esUltimo ? primerSabadoDelMes(y, mes) : ultimoSabadoDelMes(y, mes));
    sabado = ajustarAnioSiPasado(calcular(year), hoy);
    // Si al ajustar el año cambia, hay que recalcular el sábado correcto para el nuevo año.
    if (sabado.getFullYear() !== year) {
      sabado = calcular(sabado.getFullYear());
    }
  } else {
    sabado = proximoSabado(soloFecha(hoy));
  }

  const viernes = new Date(sabado.getFullYear(), sabado.getMonth(), sabado.getDate() - 1);
  const domingo = new Date(sabado.getFullYear(), sabado.getMonth(), sabado.getDate() + 1);
  return { fechaInicio: aISO(viernes), fechaFin: aISO(domingo) };
}

/** Fallback: usa chrono-node (locale ES) y empareja los resultados encontrados. */
function parseRangoConChrono(texto: string, hoy: Date): RangoFechas | null {
  const resultados = chrono.es.parse(texto, hoy, { forwardDate: true });
  if (resultados.length === 0) return null;

  const primero = resultados[0]!;
  if (primero.end) {
    return {
      fechaInicio: aISO(primero.start.date()),
      fechaFin: aISO(primero.end.date()),
    };
  }

  if (resultados.length >= 2) {
    const fechas = resultados.map((r) => r.start.date()).sort((a, b) => a.getTime() - b.getTime());
    return {
      fechaInicio: aISO(fechas[0]!),
      fechaFin: aISO(fechas[fechas.length - 1]!),
    };
  }

  return null;
}

/** Fecha única (para vuelos solo ida, por ejemplo). */
function parseFechaUnicaConChrono(texto: string, hoy: Date): string | null {
  const resultado = chrono.es.parseDate(texto, hoy, { forwardDate: true });
  return resultado ? aISO(resultado) : null;
}

export function extraerRangoFechas(texto: string, hoy: Date = new Date()): RangoFechas | null {
  return parseRangoConRegex(texto, hoy) ?? parseFinDeSemana(texto, hoy) ?? parseRangoConChrono(texto, hoy);
}

export function extraerFechaUnica(texto: string, hoy: Date = new Date()): string | null {
  return parseFechaUnicaConChrono(texto, hoy);
}
