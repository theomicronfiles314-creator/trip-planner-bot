export function extraerPresupuesto(texto: string): number | null {
  const patrones = [
    /\bm[aá]ximo\s+(\d+(?:[.,]\d+)?)\s*€?/i,
    /\bpresupuesto\s+(?:de\s+|m[aá]ximo\s+)?(\d+(?:[.,]\d+)?)\s*€?/i,
    /\bhasta\s+(\d+(?:[.,]\d+)?)\s*€/i,
    /\bno\s+m[aá]s\s+de\s+(\d+(?:[.,]\d+)?)\s*€?/i,
  ];

  for (const patron of patrones) {
    const match = texto.match(patron);
    if (match?.[1]) {
      return Number(match[1].replace(",", "."));
    }
  }

  return null;
}
