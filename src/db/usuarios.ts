import { db } from "./db.js";

const stmtUpsert = db.prepare(
  `INSERT INTO usuarios (telegram_id, username)
   VALUES (?, ?)
   ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username`
);

export function asegurarUsuario(telegramId: number, username: string | undefined): void {
  stmtUpsert.run(telegramId, username ?? null);
}
