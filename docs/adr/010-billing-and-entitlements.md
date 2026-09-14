# ADR-010: Buzrr Pro — Dodo Payments subscriptions and server-side entitlements

**Status:** Accepted

## Context

Until now every account was free. The only limit was `User.hostSizeLimit`
(default 50), added as beta/free-tier protection for hosted rooms. Buzrr Pro
adds a paid monthly plan:

|                  | Free        | Pro                              |
| ---------------- | ----------- | -------------------------------- |
| Price            | —           | $4.99/month; ₹399/month in India |
| Players per room | 50          | 250                              |
| Quizzes          | 10 total    | unlimited                        |
| AI generations   | 3, one-time | 10 per rolling week              |

Requirements: Pro is granted automatically after a confirmed subscription, the
full lifecycle (activation, renewal, cancellation, expiry, failed payments) is
handled, and **verified webhooks are the source of truth**. The product request
asked for the webhook handlers in the Next.js app.

Constraints already in the architecture:

- The web app reaches the domain only through the Nest API (invariant #28).
- Authorization facts are read from the DB per request, because JWTs live 7
  days (invariant #13).
- Buzrr-AI never writes to `public` and never adds a credential (invariants
  #31, #32). But Knowledge Space generation must spend the same AI allowance as
  `POST /api/quizzes/ai`.
- Self-hosted instances of this open-source repo have no payment provider.

## Decision

1. **Dodo Payments hosted checkout, one subscription product.** "Buzrr Pro
   Monthly" is priced at USD 4.99, with an INR localized price of ₹399
   (39900 paise). The product may use `pricing_mode: by_currency` (INR for
   anyone paying in rupees) or `by_country` keyed on `IN`; the pricing quote
   handles both. A discount set on the product itself (`discount_bps`) is
   applied by Dodo automatically and shown on the pricing pages. Dodo resolves the charged amount from the
   billing country. The pricing pages show INR to visitors in India and USD elsewhere, quoting both
   through Dodo's checkout preview, so localized prices and discounts match
   checkout exactly (`GET /api/billing/pricing`) — display
   only. **Promotions are Dodo discount codes:** `DODO_PROMO_DISCOUNT_CODE` names
   one that is re-validated live (dates, redemptions, product restriction),
   shown struck-through and applied to checkout sessions; customers can also
   enter a code, validated server-side before checkout.
2. **Webhooks: the web app verifies, Nest applies.**
   `apps/web/src/app/api/webhooks/dodo/route.ts` verifies the Standard Webhooks
   signature over the raw body, then forwards the untouched body and
   `webhook-*` headers to `POST /api/billing/webhooks/dodo`. Nest **verifies
   again**: it trusts the signature, not the hop, so no service secret exists.
   It is the only writer of billing state.
3. **Apply Dodo's current state, not the payload.** For every relevant event,
   Nest takes a per-subscription Postgres advisory lock, calls
   `subscriptions.retrieve`, and upserts the `subscriptions` row. Dodo delivers
   events unordered; a locked fresh fetch means a late event can't overwrite
   newer state.
   - The `webhook-id` idempotency claim (`billing_events` PK) commits in the
     same transaction as the effects, so a failure rolls both back and Dodo's
     redelivery retries.
   - The user comes from `metadata.userId`, which Nest sets when it creates the
     checkout session, then from an existing subscription row, then from
     `users.dodo_customer_id`. The customer's email is never used.
4. **Entitlements are derived per request.** `EntitlementsService.resolvePlan`
   reads `subscriptions`, like `RolesGuard` reads roles. Pro means either:
   - `status = active`, or
   - `status = cancelled`, with `cancel_at_period_end` set and the paid period
     not yet over.

   Everything else is Free: `on_hold`, `past_due`, `paused`, `failed`,
   `expired`, `pending`, or an immediate cancellation. Plans never appear in a
   JWT.

5. **Enforcement lives in Nest.** Limits are one table (`billing/plans.ts`):
   - `assertQuizCapacity` takes a user-row lock inside every quiz-creating
     transaction.
   - `maxPlayersFor` runs inside the existing serializable join transaction and
     returns `max(plan cap, hostSizeLimit)`. `hostSizeLimit` is kept as a
     manual override.
   - Web gates and upgrade prompts are UX only.
6. **The AI token ledger is on `users`.** It has a lifetime Free counter and a
   Pro counter with a rolling 7-day window that resets lazily on the first
   reservation after it expires. There is no cron (invariant #27).
   - Spending is one conditional `UPDATE`, so concurrent requests can't
     overspend.
   - Each spend writes an `ai_token_reservations` row with a hashed release
     token. A failed generation refunds once, and only into the window it came
     from.
   - Buzrr-AI reserves and releases through Nest using the **caller's own
     bearer token**. A user calling those routes directly can only spend their
     own tokens, and can refund only reservations they made themselves.
7. **`BILLING=ON` switches billing on.** When it's off, which is the default,
   every account resolves to Pro limits and billing routes return 503. This
   mirrors `RATELIMIT=ON`. When it's on, missing Dodo config fails at boot.

## Consequences

- **New external dependency.** A Dodo outage delays new activations: webhooks
  return 503 and are redelivered. Existing entitlements keep working because
  they are read from Postgres.
- **AI generation depends on Nest.** Buzrr-AI fails closed with 503 when Nest is
  unreachable, and needs `AI_BUZRR_API_URL`.
- **A network call inside a transaction.** Webhook and sync paths call Dodo
  while holding the advisory lock, so one DB connection is held for up to 20s.
  That buys correctness under unordered delivery, and per-subscription
  concurrency is tiny.
- **Refunds and lost disputes don't revoke Pro by themselves.** Access follows
  Dodo's subscription status, and the webhook logs these events for manual
  review.
- **After a downgrade, existing quizzes stay.** They remain hostable; only
  creating new ones is blocked. No archive concept was added.
- **Two separate token buckets.** A Pro user's usage doesn't consume the Free
  lifetime allowance, so someone who lapses back to Free still has any unused
  Free generations.
- **`apps/server` has its first test runner.** Vitest specs in
  `src/modules/billing/__tests__` run in CI against Postgres.
- **Manual Dodo dashboard setup** (not in the repo):
  - Create the product with an INR localized price of ₹399 (39900 paise).
    `by_country` + `IN` ties it to Indian billing addresses; `by_currency`
    gives it to anyone paying in INR.
  - Decide on Adaptive Currency: when it is on, customers outside India and
    the US are charged in their local currency even though the pricing
    page shows USD.
  - Register `https://<web>/api/webhooks/dodo` and subscribe it to:
    - `payment.succeeded`, `payment.failed`
    - `subscription.active`, `.renewed`, `.on_hold`, `.paused`, `.unpaused`,
      `.past_due`, `.cancelled`, `.expired`, `.failed`, `.plan_changed`,
      `.updated`
    - `refund.succeeded`, `dispute.lost`
  - Enable the customer portal, payment retries and dunning.

## Alternatives considered

- **The Next.js route writes billing rows directly with Prisma.** Rejected: it
  would widen invariant #28's direct-DB exception and split billing writes
  across two apps.
- **Trust the event payload instead of re-fetching.** Rejected: delivery is
  unordered, so a stale event could restore or revoke Pro incorrectly.
- **Dodo credit entitlements for AI tokens.** Not chosen. Spending would need a
  network round-trip per generation plus a synced balance. A local conditional
  `UPDATE` is atomic and lets refunds stay exact.

## Evidence

- `apps/server/src/modules/billing/` — `entitlements.service.ts`,
  `billing-webhook.service.ts`, `subscription-sync.service.ts`,
  `billing.service.ts`, `plans.ts`
- `apps/web/src/app/api/webhooks/dodo/route.ts`
- `apps/ai/src/buzrr_ai/billing.py`
- `packages/prisma/migrations/20260914000001_add_billing_and_entitlements/`
