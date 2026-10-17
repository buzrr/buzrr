-- Game sound skins (uploaded MP3 per moment; built-in skins have no row) and
-- where a question's own sound plays (null = like the quiz).
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "audioPlayOn" TEXT;

-- CreateTable
CREATE TABLE "sound_skins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "slots" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sound_skins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sound_skins_user_id_idx" ON "sound_skins"("user_id");

-- AddForeignKey
ALTER TABLE "sound_skins" ADD CONSTRAINT "sound_skins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
