import type { BotContext } from "../session.js";
import { asegurarUsuario } from "../../db/usuarios.js";

export async function manejarStart(ctx: BotContext): Promise<void> {
  if (ctx.from) {
    asegurarUsuario(ctx.from.id, ctx.from.username);
  }
  ctx.session.busquedaEnCurso = null;
  ctx.session.ultimaBusqueda = null;

  await ctx.reply(
    "¡Hola! 👋 Soy tu asistente de viajes.\n\n" +
      "Cuéntame en una frase lo que necesitas y yo busco y comparo por ti. Por ejemplo:\n\n" +
      "• Viaje para dos personas del 21 al 23 de septiembre a Altea\n" +
      "• Alojamiento en Valencia del 5 al 8 de octubre, 4 personas, máximo 300€\n\n" +
      "Por ahora puedo buscar <b>alojamiento</b> (coche y vuelos llegarán pronto). " +
      "Tras cada resultado puedes pedirme \"más barato\", \"otra opción\", \"ver todas\" o \"cancelar\".",
    { parse_mode: "HTML" }
  );
}
