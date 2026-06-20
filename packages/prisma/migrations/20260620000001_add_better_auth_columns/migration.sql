-- Migration: add columns required by better-auth that were missing after the
-- Next-Auth → better-auth schema migration.

-- accounts: token expiry timestamps, password, audit timestamps
ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "access_token_expires_at"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "password"                 TEXT,
  ADD COLUMN IF NOT EXISTS "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- sessions: request metadata and audit timestamps
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "ip_address"  TEXT,
  ADD COLUMN IF NOT EXISTS "user_agent"  TEXT,
  ADD COLUMN IF NOT EXISTS "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- users: audit timestamps (email_verified was already migrated to BOOLEAN)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
