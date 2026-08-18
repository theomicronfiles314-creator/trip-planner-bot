import type { StorageAdapter } from "grammy";
import { db } from "../db/db.js";
import type { SessionData } from "./session.js";

/**
 * Storage de sesiones respaldado por SQLite en vez del storage en memoria por
 * defecto de grammy. Es imprescindible en el modo de ciclo único (GitHub
 * Actions): cada ejecución arranca en una máquina nueva, así que la sesión
 * (busquedaEnCurso, ultimaBusqueda) tiene que sobrevivir en el .sqlite que el
 * workflow comitea de vuelta al repo entre ciclos.
 */
export function storageSqlite(): StorageAdapter<SessionData> {
  const leer = db.prepare("SELECT valor FROM sesiones WHERE clave = ?");
  const escribir = db.prepare("INSERT INTO sesiones (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor");
  const borrar = db.prepare("DELETE FROM sesiones WHERE clave = ?");

  return {
    read(clave) {
      const fila = leer.get(clave) as { valor: string } | undefined;
      return fila ? (JSON.parse(fila.valor) as SessionData) : undefined;
    },
    write(clave, valor) {
      escribir.run(clave, JSON.stringify(valor));
    },
    delete(clave) {
      borrar.run(clave);
    },
  };
}
