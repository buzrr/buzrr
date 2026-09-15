import type { Metadata } from "next";
import BillingClient from "@/components/Admin/Billing/BillingClient";

export const metadata: Metadata = {
  title: "Plan & Billing",
};

export default function Page() {
  return <BillingClient />;
}
