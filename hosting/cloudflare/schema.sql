CREATE TABLE IF NOT EXISTS challenges (
 nonce TEXT PRIMARY KEY,
 account TEXT NOT NULL,
 message TEXT NOT NULL,
 recipient TEXT NOT NULL,
 expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS challenges_expiry ON challenges(expires);
CREATE TABLE IF NOT EXISTS auth_rate (
 bucket TEXT PRIMARY KEY,
 n INTEGER NOT NULL,
 expires INTEGER NOT NULL
);
