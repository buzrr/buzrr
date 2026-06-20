-- Rename expires_at → expiresAt to match the Prisma schema field name without
-- a @map directive, consistent with createdAt/updatedAt in the same table.
ALTER TABLE "verification" RENAME COLUMN "expires_at" TO "expiresAt";
