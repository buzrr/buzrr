-- Buzrr Pro: Dodo Payments subscriptions, webhook idempotency, and AI token
-- accounting. See docs/adr/010-billing-and-entitlements.md.
--
-- Plans are derived from `subscriptions` rows at request time; nothing here
-- caches a plan on the user. `host_size_limit` is kept as a manual override
-- (effective room cap = max(plan cap, host_size_limit)).

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'active', 'on_hold', 'paused', 'past_due', 'cancelled', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "AiTokenSource" AS ENUM ('quiz_ai', 'rag');

-- CreateEnum
CREATE TYPE "AiTokenBucket" AS ENUM ('free', 'pro');

-- CreateEnum
CREATE TYPE "AiTokenReservationStatus" AS ENUM ('consumed', 'refunded');

-- AlterTable
-- Existing users start with zero AI tokens spent on either plan.
ALTER TABLE "users" ADD COLUMN "dodo_customer_id" TEXT,
ADD COLUMN "free_ai_tokens_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pro_ai_tokens_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pro_ai_window_start" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "dodo_subscription_id" TEXT NOT NULL,
    "dodo_customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currency" TEXT NOT NULL,
    "recurring_amount" INTEGER NOT NULL,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- One row per Dodo `webhook-id`; a redelivery conflicts on the PK and is skipped.
CREATE TABLE "billing_events" (
    "webhook_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "object_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("webhook_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "dodo_payment_id" TEXT NOT NULL,
    "user_id" TEXT,
    "dodo_subscription_id" TEXT,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_token_reservations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "AiTokenSource" NOT NULL,
    "bucket" "AiTokenBucket" NOT NULL,
    "window_start" TIMESTAMP(3),
    "status" "AiTokenReservationStatus" NOT NULL DEFAULT 'consumed',
    "release_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_dodo_customer_id_key" ON "users"("dodo_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_dodo_subscription_id_key" ON "subscriptions"("dodo_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_dodo_customer_id_idx" ON "subscriptions"("dodo_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_dodo_payment_id_key" ON "payments"("dodo_payment_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "ai_token_reservations_user_id_created_at_idx" ON "ai_token_reservations"("user_id", "created_at");

-- AddForeignKey
-- SET NULL: billing history outlives account deletion.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_token_reservations" ADD CONSTRAINT "ai_token_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
