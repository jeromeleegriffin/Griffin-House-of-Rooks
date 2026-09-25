-- Griffin House of Rooks progression v2 — future Cloudflare D1 schema
CREATE TABLE IF NOT EXISTS players (player_id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, career_json TEXT NOT NULL DEFAULT '{}', achievements_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS recovery (recovery_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(player_id) REFERENCES players(player_id));
CREATE INDEX IF NOT EXISTS idx_recovery_player ON recovery(player_id);
