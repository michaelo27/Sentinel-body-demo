CREATE TABLE IF NOT EXISTS agent_report_tasks (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 report_id TEXT NOT NULL,
 watch_id TEXT NOT NULL,
 token_id TEXT NOT NULL,
 agent_account TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 created INTEGER NOT NULL,
 UNIQUE(owner,report_id,token_id)
);
CREATE INDEX IF NOT EXISTS agent_report_tasks_owner_created ON agent_report_tasks(owner,created);
