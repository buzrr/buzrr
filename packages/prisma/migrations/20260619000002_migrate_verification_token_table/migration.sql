-- Migration: replace verificationtokens with verification
-- Old table: identifier, token (unique), expires — no surrogate PK.
-- New table: id (PK), identifier, value, expires_at, created_at, updated_at.
-- No foreign keys reference verificationtokens, so data can be moved directly.

CREATE TABLE "verification" (
    "id"          TEXT         NOT NULL,
    "identifier"  TEXT         NOT NULL,
    "value"       TEXT         NOT NULL,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "created_at"  TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- Backfill: token → value, expires → expires_at.
-- gen_random_uuid() provides the surrogate PK (available in PostgreSQL 13+;
-- enable pgcrypto on older versions via: CREATE EXTENSION IF NOT EXISTS pgcrypto;).
INSERT INTO "verification" ("id", "identifier", "value", "expires_at", "created_at", "updated_at")
SELECT
    gen_random_uuid()::TEXT,
    "identifier",
    "token",
    "expires",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "verificationtokens";

DROP TABLE "verificationtokens";
