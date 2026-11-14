-- Additive migration. Existing authentication tables are untouched.
CREATE TABLE IF NOT EXISTS watches (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 network TEXT NOT NULL CHECK(network IN ('mainnet','testnet')),
 account TEXT NOT NULL,
 threshold_yocto TEXT NOT NULL,
 created INTEGER NOT NULL,
 next_due INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 UNIQUE(owner, network, account)
);
CREATE INDEX IF NOT EXISTS watches_owner ON watches(owner);
CREATE INDEX IF NOT EXISTS watches_due ON watches(next_due);
CREATE TABLE IF NOT EXISTS observations (
 watch_id TEXT NOT NULL,
 observed_at INTEGER NOT NULL,
 block_height INTEGER NOT NULL,
 block_hash TEXT NOT NULL,
 block_timestamp_ns TEXT NOT NULL,
 amount TEXT NOT NULL,
 locked TEXT NOT NULL,
 storage_usage INTEGER NOT NULL,
 source TEXT NOT NULL,
 PRIMARY KEY (watch_id, block_hash)
);
CREATE INDEX IF NOT EXISTS observations_latest ON observations(watch_id, observed_at DESC);
CREATE TABLE IF NOT EXISTS monitor_lock (
 id TEXT PRIMARY KEY,
 lease_until INTEGER NOT NULL,
 token TEXT NOT NULL
);
