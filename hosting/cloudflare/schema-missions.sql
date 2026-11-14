-- MIS01 additive only. Existing tables and quota history are preserved.
CREATE TABLE IF NOT EXISTS buddy_profiles (
 owner TEXT NOT NULL, token_id TEXT NOT NULL, profile_json TEXT NOT NULL,
 updated INTEGER NOT NULL, PRIMARY KEY(owner,token_id)
);
CREATE TABLE IF NOT EXISTS buddy_cases (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, token_id TEXT NOT NULL,
 agent_account TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL,
 created INTEGER NOT NULL, status TEXT NOT NULL,
 evidence_json TEXT, evidence_hash TEXT, error TEXT,
 reviewed_at INTEGER, UNIQUE(owner,id)
);
CREATE INDEX IF NOT EXISTS buddy_cases_owner ON buddy_cases(owner,token_id,created);
-- Model attempts use the existing ai_reports table so old and new AI features share quotas.
-- No automatic model calls, transaction signing or scheduled missions are introduced.
