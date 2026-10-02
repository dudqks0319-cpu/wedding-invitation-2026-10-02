-- Additive migration. Existing Osamosam identities, sessions, drafts and media stay intact.
CREATE TABLE IF NOT EXISTS w2_invitations (
 slug TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL CHECK(json_valid(data)),
 public_data TEXT CHECK(public_data IS NULL OR json_valid(public_data)),
 expires_at TEXT NOT NULL, public_expires_at TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS w2_owner ON w2_invitations(owner_id,updated_at);
CREATE TABLE IF NOT EXISTS w2_photos (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), key TEXT UNIQUE NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes>=0), state TEXT NOT NULL CHECK(state IN('uploading','ready','deleting')),
 mutation_id TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(owner_id,mutation_id)
);
CREATE INDEX IF NOT EXISTS w2_photos_owner ON w2_photos(owner_id,state);
CREATE TABLE IF NOT EXISTS w2_guestbook (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL REFERENCES w2_invitations(slug) ON DELETE CASCADE,
 name TEXT NOT NULL,message TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,
 created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS w2_rsvp (
 id TEXT PRIMARY KEY,slug TEXT NOT NULL REFERENCES w2_invitations(slug) ON DELETE CASCADE,
 data TEXT NOT NULL CHECK(json_valid(data)),created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS w2_guestbook_slug ON w2_guestbook(slug,created_at);
CREATE INDEX IF NOT EXISTS w2_rsvp_slug ON w2_rsvp(slug,created_at);
CREATE TABLE IF NOT EXISTS w2_operations (
 scope TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 claim TEXT NOT NULL,result TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(scope,id)
);
CREATE TABLE IF NOT EXISTS w2_limits (
 scope TEXT NOT NULL,action TEXT NOT NULL,window INTEGER NOT NULL,hits INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,PRIMARY KEY(scope,action,window)
);
CREATE TABLE IF NOT EXISTS w2_controls (name TEXT PRIMARY KEY,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)));
INSERT OR IGNORE INTO w2_controls VALUES('api',1),('uploads',0);
