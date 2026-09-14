import type { Metadata } from "next";
import CheckoutSuccessClient from "@/components/Billing/CheckoutSuccessClient";
import { requireBillingSession } from "@/lib/billing-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirming your upgrade",
  robots: { index: false },
};

/**
 * Dodo's `return_url`. Deliberately ignores every query parameter Dodo appends:
 * access comes only from the verified webhook, so this page just waits for the
 * API to report Pro.
 */
export default async function CheckoutSuccessPage() {
  await requireBillingSession("/billing/success");
  return <CheckoutSuccessClient />;
}
