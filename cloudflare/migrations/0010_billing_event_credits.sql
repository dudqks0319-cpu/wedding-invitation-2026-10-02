-- Local-only entitlement foundation. The HTTP billing gate remains closed.
-- Keep a consumed transaction after invitation deletion without retaining its slug.
CREATE TABLE IF NOT EXISTS w2_event_credits (
 environment TEXT NOT NULL CHECK(environment='Production'),
 transaction_id TEXT NOT NULL,
 invitation_slug TEXT REFERENCES w2_invitations(slug) ON DELETE SET NULL,
 applied_at TEXT NOT NULL,
 PRIMARY KEY(environment,transaction_id),
 FOREIGN KEY(environment,transaction_id)
  REFERENCES w2_apple_transactions(environment,transaction_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS w2_event_credit_invitation ON w2_event_credits(invitation_slug);
