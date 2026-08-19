const STOP = "(?:del|desde|para|con|hasta|al|el)";
const PALABRA = `(?:(?!${STOP}\\b)[a-zà-ÿ]+)`;
const LIMITE = `(?=\\s+${STOP}\\b|\\s*,|\\s+\\d|$)`;
// País opcional tras el destino ("Cuenca, Ecuador"): si el usuario ya lo da
// explícito, se conserva en vez de recortarlo en la coma, para no tener que
// preguntar después a qué país se refería. El límite final se comprueba una
// única vez, después de este grupo opcional (lo consuma o no).
const PAIS_OPCIONAL = `(?:\\s*,\\s*(${PALABRA}(?:\\s+${PALABRA}){0,2}))?`;

function capitalizar(texto: string): string {
  return texto
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(" ");
}

export interface OrigenDestino {
  origen: string | null;
  destino: string | null;
}

/** Para vuelos: "Madrid-Roma", "de Madrid a Roma", "Madrid a Roma". */
export function extraerOrigenDestino(texto: string): OrigenDestino {
  // Ciudad-Ciudad: se restringe a una sola palabra por lado para no arrastrar
  // términos previos como "Vuelos" (p.ej. "Vuelos Madrid-Roma").
  const patronGuion = new RegExp(`\\b([a-zà-ÿ]+)\\s*-\\s*([a-zà-ÿ]+)${LIMITE}`, "i");
  const patronDeA = new RegExp(
    `\\bde\\s+(${PALABRA}(?:\\s+${PALABRA})?)\\s+a\\s+(${PALABRA}(?:\\s+${PALABRA})?)${LIMITE}`,
    "i"
  );

  const matchDeA = texto.match(patronDeA);
  if (matchDeA?.[1] && matchDeA[2]) {
    return { origen: capitalizar(matchDeA[1]), destino: capitalizar(matchDeA[2]) };
  }

  const matchGuion = texto.match(patronGuion);
  if (matchGuion?.[1] && matchGuion[2]) {
    return { origen: capitalizar(matchGuion[1]), destino: capitalizar(matchGuion[2]) };
  }

  return { origen: null, destino: null };
}

function combinarCiudadPais(ciudad: string, pais: string | undefined): string {
  return pais ? `${capitalizar(ciudad)}, ${capitalizar(pais)}` : capitalizar(ciudad);
}

/**
 * Para alojamiento/coche: "a Altea", "en Valencia", "cerca de Alcañiz", y
 * opcionalmente con país explícito ("en Cuenca, Ecuador") para evitar tener
 * que preguntar después a qué país se refería.
 */
export function extraerDestino(texto: string): string | null {
  const patronCercaDe = new RegExp(`\\bcerca\\s+de\\s+(${PALABRA}(?:\\s+${PALABRA}){0,2})${PAIS_OPCIONAL}${LIMITE}`, "i");
  const patronEn = new RegExp(`\\ben\\s+(${PALABRA}(?:\\s+${PALABRA}){0,2})${PAIS_OPCIONAL}${LIMITE}`, "i");
  const patronA = new RegExp(`\\ba\\s+(${PALABRA}(?:\\s+${PALABRA}){0,2})${PAIS_OPCIONAL}${LIMITE}`, "i");

  const matchCercaDe = texto.match(patronCercaDe);
  if (matchCercaDe?.[1]) return combinarCiudadPais(matchCercaDe[1], matchCercaDe[2]);

  const matchEn = texto.match(patronEn);
  if (matchEn?.[1]) return combinarCiudadPais(matchEn[1], matchEn[2]);

  const matchA = texto.match(patronA);
  if (matchA?.[1]) return combinarCiudadPais(matchA[1], matchA[2]);

  return null;
}
