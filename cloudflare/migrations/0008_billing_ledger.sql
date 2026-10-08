-- Local payment foundation only. Sales remain disabled until a verified adapter and budget reservation exist.
CREATE TABLE IF NOT EXISTS w2_billing_accounts (
 owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 app_account_token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS w2_apple_transactions (
 environment TEXT NOT NULL CHECK(environment IN('Sandbox','Production')),
 transaction_id TEXT NOT NULL,
 product_id TEXT NOT NULL, account_token_hash TEXT NOT NULL,
 owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 purchased_at INTEGER NOT NULL, signed_at INTEGER NOT NULL,
 revoked_at INTEGER, recorded_at TEXT NOT NULL,
 PRIMARY KEY(environment,transaction_id)
);
CREATE INDEX IF NOT EXISTS w2_apple_transaction_owner ON w2_apple_transactions(owner_id,revoked_at);
