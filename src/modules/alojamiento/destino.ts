/**
 * Sesga el destino hacia España cuando no se especifica país: este bot está
 * pensado para viajes dentro de España, y nombres de ciudad ambiguos entre
 * países (p.ej. "Cuenca" en España vs. Ecuador) deben resolverse a España por
 * defecto en vez de dejar que cada web decida a su manera. Se usa para
 * plataformas con búsqueda por texto libre (Booking, Airbnb), donde no hay
 * una lista de sugerencias sobre la que elegir.
 */
export function sesgarDestinoEspana(destino: string): string {
  return destino.includes(",") ? destino : `${destino}, España`;
}
