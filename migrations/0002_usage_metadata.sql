-- Wrangler applies this migration transactionally. Existing event data and row IDs
-- are copied before the table is replaced; old location/browser fields stay NULL.
CREATE TABLE conversion_events_with_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  received_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  input_url TEXT NOT NULL,
  output_url TEXT,
  no_solution_check INTEGER NOT NULL CHECK (no_solution_check IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  input_format TEXT,
  error TEXT,
  version TEXT NOT NULL,
  country TEXT,
  region TEXT,
  city TEXT,
  colo TEXT,
  user_agent TEXT,
  CHECK ((status = 'success' AND output_url IS NOT NULL AND error IS NULL)
      OR (status = 'error' AND output_url IS NULL AND error IS NOT NULL))
);

INSERT INTO conversion_events_with_metadata
  (id, event_id, received_at, started_at, input_url, output_url,
   no_solution_check, status, input_format, error, version)
SELECT rowid, event_id, received_at, started_at, input_url, output_url,
       no_solution_check, status, input_format, error, version
FROM conversion_events
ORDER BY rowid;

DROP TABLE conversion_events;
ALTER TABLE conversion_events_with_metadata RENAME TO conversion_events;

CREATE INDEX conversion_events_received_at ON conversion_events(received_at);
