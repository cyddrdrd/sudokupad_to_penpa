-- This schema is additive and safe to reapply to an existing database.
CREATE TABLE IF NOT EXISTS conversion_events (
  event_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  input_url TEXT NOT NULL,
  output_url TEXT,
  no_solution_check INTEGER NOT NULL CHECK (no_solution_check IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  input_format TEXT,
  error TEXT,
  version TEXT NOT NULL,
  CHECK ((status = 'success' AND output_url IS NOT NULL AND error IS NULL)
      OR (status = 'error' AND output_url IS NULL AND error IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS conversion_events_received_at
  ON conversion_events(received_at);
