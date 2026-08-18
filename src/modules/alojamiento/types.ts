export interface ParametrosAlojamiento {
  destino: string;
  fechaInicio: string;
  fechaFin: string;
  personas: number;
  presupuestoMax?: number;
}

export interface AlojamientoResultado {
  fuente: "booking" | "airbnb" | "hostelworld" | "agoda";
  nombre: string;
  precioTotal: number;
  precioPorNoche: number;
  moneda: string;
  rating: number | null;
  ratingEscala: number;
  numeroReviews: number;
  fotoUrl: string | null;
  distanciaTexto: string | null;
  url: string;
  score?: number;
}
