-- Additive. Attempts count even when failed. Do not delete rows to reset budget.
CREATE TABLE IF NOT EXISTS ai_reports (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 watch_id TEXT NOT NULL,
 input_hash TEXT NOT NULL,
 model TEXT NOT NULL,
 created INTEGER NOT NULL,
 status TEXT NOT NULL,
 evidence_json TEXT NOT NULL,
 result_json TEXT,
 error TEXT,
 UNIQUE(owner,watch_id,input_hash,model)
);
CREATE INDEX IF NOT EXISTS ai_reports_owner_created ON ai_reports(owner,created);
CREATE INDEX IF NOT EXISTS ai_reports_created ON ai_reports(created);
