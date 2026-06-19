-- Migration: convert users.email_verified from TIMESTAMP to BOOLEAN
-- Non-null timestamps become true (email was verified), null becomes false.

ALTER TABLE "users"
  ALTER COLUMN "email_verified" TYPE BOOLEAN
  USING ("email_verified" IS NOT NULL);

ALTER TABLE "users"
  ALTER COLUMN "email_verified" SET NOT NULL;

ALTER TABLE "users"
  ALTER COLUMN "email_verified" SET DEFAULT false;
