CREATE TABLE IF NOT EXISTS w2_moderation_holds (
 slug TEXT PRIMARY KEY REFERENCES w2_invitations(slug) ON DELETE CASCADE,
 report_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS w2_operator_actions (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, action TEXT NOT NULL,
 target_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS w2_operator_actions_created ON w2_operator_actions(created_at);
