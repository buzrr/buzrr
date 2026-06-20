-- Add createdAt/updatedAt to verification table (required by better-auth)
ALTER TABLE "verification"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
