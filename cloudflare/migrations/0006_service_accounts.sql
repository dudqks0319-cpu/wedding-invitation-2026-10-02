-- New-service controls only. Never delete or migrate legacy Osamosam data here.
CREATE TABLE IF NOT EXISTS w2_account_deletions (
 owner_id TEXT PRIMARY KEY, requested_at TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('pending','complete')),
 apple_only INTEGER NOT NULL DEFAULT 0 CHECK(apple_only IN(0,1))
);
CREATE TABLE IF NOT EXISTS w2_session_links (
 token_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS w2_session_owner ON w2_session_links(owner_id);
CREATE TABLE IF NOT EXISTS w2_photo_activity (
 photo_id TEXT PRIMARY KEY REFERENCES w2_photos(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS w2_apple_flows (
 id TEXT PRIMARY KEY, nonce_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS w2_apple_identities (
 subject TEXT PRIMARY KEY, owner_id TEXT UNIQUE NOT NULL REFERENCES users(id), refresh_cipher TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS w2_apple_revocations (
 owner_id TEXT PRIMARY KEY, refresh_cipher TEXT NOT NULL, created_at TEXT NOT NULL, subject_hash TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS w2_support (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL,
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 1000),
 status TEXT NOT NULL DEFAULT 'received', reply TEXT, created_at TEXT NOT NULL,
 mutation_id TEXT NOT NULL, UNIQUE(owner_id,mutation_id)
);
CREATE TABLE IF NOT EXISTS w2_reports (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL, entry_id TEXT, reporter_key TEXT NOT NULL,
 reason TEXT NOT NULL, message TEXT NOT NULL CHECK(length(message)<=500), created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'received', mutation_id TEXT NOT NULL,
 UNIQUE(reporter_key,mutation_id)
);
CREATE INDEX IF NOT EXISTS w2_reports_created ON w2_reports(created_at);
CREATE TABLE IF NOT EXISTS w2_guest_authors (
 entry_id TEXT PRIMARY KEY REFERENCES w2_guestbook(id) ON DELETE CASCADE, author_key TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS w2_guest_blocks (
 slug TEXT NOT NULL REFERENCES w2_invitations(slug) ON DELETE CASCADE,
 author_key TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(slug,author_key)
);
INSERT OR IGNORE INTO w2_controls VALUES('apple_login',0),('billing',0),('support',1),('reports',1);
