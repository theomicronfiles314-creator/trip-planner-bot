export type TipoBusqueda = "alojamiento" | "coche" | "vuelos";

export interface BusquedaParseada {
  tipo: TipoBusqueda | null;
  destino: string | null;
  origen: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  personas: number | null;
  presupuesto: number | null;
}

export type CampoFaltante = "tipo" | "destino" | "origen" | "fechaInicio" | "fechaFin" | "personas";

export const CAMPO_LABEL: Record<CampoFaltante, string> = {
  tipo: "qué tipo de búsqueda quieres (alojamiento, coche o vuelos)",
  destino: "el destino",
  origen: "el origen del vuelo",
  fechaInicio: "la fecha de inicio",
  fechaFin: "la fecha de fin",
  personas: "el número de personas",
};
