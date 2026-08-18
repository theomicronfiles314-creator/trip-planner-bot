/**
 * Si el destino ya viene cualificado con país (p.ej. "Cuenca, España", tras
 * pasar por la desambiguación de geocoding.ts), devuelve esa parte del país.
 * Se usa en los scrapers que eligen entre varias sugerencias (Hostelworld,
 * Agoda) para preferir la que coincida, en vez de asumir siempre España.
 */
export function extraerPaisDeDestino(destino: string): string | null {
  const partes = destino.split(",");
  if (partes.length < 2) return null;
  const pais = partes[partes.length - 1]!.trim();
  return pais || null;
}
