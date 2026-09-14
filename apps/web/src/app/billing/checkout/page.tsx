import type { Metadata } from "next";
import CheckoutClient from "@/components/Billing/CheckoutClient";
import { requireBillingSession } from "@/lib/billing-session";
import { getVisitorPriceRegion } from "@/lib/visitor-region";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upgrade to Buzrr Pro",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const session = await requireBillingSession("/billing/checkout");
  const region = await getVisitorPriceRegion();
  return <CheckoutClient email={session.user.email} serverRegion={region} />;
}
