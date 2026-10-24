-- Game sound skins (uploaded MP3 per moment; built-in skins have no row).
CREATE TABLE IF NOT EXISTS "sound_skins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "slots" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sound_skins_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sound_skins_user_id_idx" ON "sound_skins"("user_id");
DO $$ BEGIN
  ALTER TABLE "sound_skins" ADD CONSTRAINT "sound_skins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
