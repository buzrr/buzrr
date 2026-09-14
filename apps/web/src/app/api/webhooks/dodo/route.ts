import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";

/**
 * Dodo Payments webhook receiver.
 *
 * The web app verifies the signature and forwards the untouched event to the
 * Nest API, which verifies it again and applies it
 * (`apps/server/src/modules/billing/billing-webhook.service.ts`). All billing
 * writes stay behind the API — the web app only talks to the domain through
 * Nest (invariant #28), and the forward never asks Nest to trust this hop.
 *
 * Status codes drive Dodo's retries: 2xx acknowledges, anything else is
 * redelivered (up to 8 attempts over ~27h).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARD_TIMEOUT_MS = 10_000;

/** Must match `HANDLED_EVENT_TYPES` on the server. */
const LIFECYCLE_EVENT_TYPES = new Set([
  "payment.failed",
  "subscription.renewed",
  "subscription.on_hold",
  "subscription.paused",
  "subscription.unpaused",
  "subscription.past_due",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
  "subscription.plan_changed",
  "subscription.updated",
  "refund.succeeded",
  "dispute.lost",
]);

type PaymentSucceededEvent = {
  type: "payment.succeeded";
  data: { payment_id: string; subscription_id?: string | null };
};

type SubscriptionActiveEvent = {
  type: "subscription.active";
  data: { subscription_id: string; status: string };
};

type OtherEvent = { type: string; data?: unknown };

type DodoEvent = PaymentSucceededEvent | SubscriptionActiveEvent | OtherEvent;

function forwardTarget(): string | null {
  const origin =
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  return origin
    ? `${origin.replace(/\/$/, "")}/api/billing/webhooks/dodo`
    : null;
}

export async function POST(req: Request) {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  const target = forwardTarget();
  if (!webhookKey || !target) {
    console.error(
      "[dodo-webhook] DODO_PAYMENTS_WEBHOOK_KEY or the API URL is not configured",
    );
    // Non-2xx so Dodo keeps the event and retries once this is fixed.
    return NextResponse.json(
      { error: "Webhook misconfigured" },
      { status: 500 },
    );
  }

  // The exact bytes Dodo signed — never parse and re-serialize before verifying.
  const rawBody = await req.text();
  const webhookHeaders = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
  };

  let event: DodoEvent;
  try {
    // Checks the HMAC over `id.timestamp.body` and rejects stale timestamps.
    event = new Webhook(webhookKey).verify(
      rawBody,
      webhookHeaders,
    ) as DodoEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  switch (event.type) {
    case "payment.succeeded": {
      const { data } = event as PaymentSucceededEvent;
      console.info(
        `[dodo-webhook] payment.succeeded ${data.payment_id} (subscription ${data.subscription_id ?? "none"})`,
      );
      break;
    }
    case "subscription.active": {
      const { data } = event as SubscriptionActiveEvent;
      // Pro is granted by the API after it re-fetches this subscription from
      // Dodo — nothing here trusts the payload to decide access.
      console.info(
        `[dodo-webhook] subscription.active ${data.subscription_id}`,
      );
      break;
    }
    default:
      if (!LIFECYCLE_EVENT_TYPES.has(event.type)) {
        // Verified but irrelevant to Buzrr (payouts, credits, …): acknowledge.
        return NextResponse.json({ received: true, ignored: true });
      }
  }

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", ...webhookHeaders },
      body: rawBody,
      cache: "no-store",
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
    if (res.ok) {
      return NextResponse.json({ received: true });
    }
    if (res.status === 401) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.error(
      `[dodo-webhook] API rejected ${event.type} ${webhookHeaders["webhook-id"]}: HTTP ${res.status}`,
    );
  } catch (err) {
    console.error(
      `[dodo-webhook] forwarding ${event.type} ${webhookHeaders["webhook-id"]} failed`,
      err,
    );
  }
  // 503 → Dodo redelivers; the API's idempotency ledger makes replays safe.
  return NextResponse.json(
    { error: "Webhook processing failed" },
    { status: 503 },
  );
}
