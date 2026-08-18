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

-- Storage de sesiones de grammy (busquedaEnCurso, ultimaBusqueda por chat).
-- Necesario para que la conversación sobreviva entre ciclos de GitHub Actions,
-- donde cada ejecución arranca en una máquina nueva sin memoria del proceso anterior.
CREATE TABLE IF NOT EXISTS sesiones (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Ajustes de un solo valor (p.ej. el offset de Telegram getUpdates) que también
-- necesitan persistir entre ciclos.
CREATE TABLE IF NOT EXISTS ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
