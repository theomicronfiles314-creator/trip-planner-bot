import { InlineKeyboard } from "grammy";
import { banderaDesdeCodigo, type CandidatoDestino } from "../modules/alojamiento/geocoding.js";

export const CB_MAS_BARATO = "mas_barato";
export const CB_OTRA_OPCION = "otra_opcion";
export const CB_VER_TODAS = "ver_todas";
export const CB_CANCELAR = "cancelar";
export const CB_DESTINO_PREFIJO = "destino:";

export function tecladoResultado(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⬅️ Más barato", CB_MAS_BARATO)
    .text("🔄 Otra opción", CB_OTRA_OPCION)
    .row()
    .text("📋 Ver todas", CB_VER_TODAS)
    .text("❌ Cancelar", CB_CANCELAR);
}

export function tecladoDesambiguacion(candidatos: CandidatoDestino[]): InlineKeyboard {
  const teclado = new InlineKeyboard();
  candidatos.forEach((candidato, indice) => {
    teclado.text(`${banderaDesdeCodigo(candidato.codigoPais)} ${candidato.destinoCompleto}`, `${CB_DESTINO_PREFIJO}${indice}`).row();
  });
  teclado.text("❌ Cancelar", CB_CANCELAR);
  return teclado;
}
