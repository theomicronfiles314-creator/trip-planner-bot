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

const NUMERO_O_TEXTO = `(\\d+|${Object.keys(NUMEROS_TEXTO).join("|")})`;

function aNumero(token: string): number {
  const limpio = token.toLowerCase();
  return NUMEROS_TEXTO[limpio] ?? Number(limpio);
}

export function extraerPersonas(texto: string): number | null {
  const patrones = [
    new RegExp(`\\bpara\\s+${NUMERO_O_TEXTO}\\s+personas?\\b`, "i"),
    new RegExp(`\\bsomos\\s+${NUMERO_O_TEXTO}\\b`, "i"),
    new RegExp(`\\b${NUMERO_O_TEXTO}\\s+personas?\\b`, "i"),
    new RegExp(`\\b${NUMERO_O_TEXTO}\\s+pax\\b`, "i"),
    new RegExp(`\\b${NUMERO_O_TEXTO}\\s+pasajeros?\\b`, "i"),
    new RegExp(`\\b${NUMERO_O_TEXTO}\\s+adultos?\\b`, "i"),
  ];

  for (const patron of patrones) {
    const match = texto.match(patron);
    if (match?.[1]) {
      const numero = aNumero(match[1]);
      if (numero > 0) return numero;
    }
  }

  return null;
}
