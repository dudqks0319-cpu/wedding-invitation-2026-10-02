-- Local-only until the Apple verifier, paid benefit contract and budget gate are ready.
ALTER TABLE w2_apple_transactions ADD COLUMN refund_state_signed_at INTEGER NOT NULL DEFAULT 0;
UPDATE w2_apple_transactions SET refund_state_signed_at=signed_at WHERE revoked_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS w2_apple_refund_notifications (
 environment TEXT NOT NULL CHECK(environment IN('Sandbox','Production')),
 notification_id TEXT NOT NULL, transaction_id TEXT NOT NULL,
 notification_type TEXT NOT NULL CHECK(notification_type IN('REFUND','REFUND_REVERSED')),
 signed_at INTEGER NOT NULL, revoked_at INTEGER, payload_hash TEXT NOT NULL, recorded_at TEXT NOT NULL,
 PRIMARY KEY(environment,notification_id)
);
CREATE INDEX IF NOT EXISTS w2_apple_refund_transaction
 ON w2_apple_refund_notifications(environment,transaction_id,signed_at);
