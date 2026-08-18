import { InlineKeyboard } from "grammy";

export const CB_MAS_BARATO = "mas_barato";
export const CB_OTRA_OPCION = "otra_opcion";
export const CB_VER_TODAS = "ver_todas";
export const CB_CANCELAR = "cancelar";

export function tecladoResultado(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⬅️ Más barato", CB_MAS_BARATO)
    .text("🔄 Otra opción", CB_OTRA_OPCION)
    .row()
    .text("📋 Ver todas", CB_VER_TODAS)
    .text("❌ Cancelar", CB_CANCELAR);
}
