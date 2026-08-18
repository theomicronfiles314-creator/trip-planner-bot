CREATE TABLE IF NOT EXISTS usuarios (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  preferencias_json TEXT NOT NULL DEFAULT '{}',
  fecha_alta TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS busquedas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('alojamiento', 'coche', 'vuelos')),
  parametros_json TEXT NOT NULL,
  resultados_json TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios (telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_busquedas_usuario ON busquedas (usuario_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS cache_resultados (
  clave_busqueda TEXT PRIMARY KEY,
  resultados_json TEXT NOT NULL,
  expira_en TEXT NOT NULL
);
