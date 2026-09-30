import type { Metadata } from "next";
import { headers } from "next/headers";
import LandingNavbar from "@/components/Landing/LandingNavbar";
import LandingFooter from "@/components/Landing/LandingFooter";
import PricingPlans from "@/components/Pricing/PricingPlans";
import PricingFaq from "@/components/Pricing/PricingFaq";
import PlanComparison from "@/components/Pricing/PlanComparison";
import { auth } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getVisitorPriceRegion } from "@/lib/visitor-region";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing: Free and Pro Plans",
  description:
    "Buzrr is free to start. Buzrr Pro unlocks 250-player rooms, unlimited quizzes and 10 AI quiz generations every week.",
  path: "/pricing",
});

export default async function PricingPage() {
  const [region, session] = await Promise.all([
    getVisitorPriceRegion(),
    auth.api.getSession({ headers: await headers() }).catch(() => null),
  ]);

  return (
    <div className="min-h-dvh flex flex-col bg-light-bg dark:bg-dark-bg">
      <LandingNavbar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center animate-fade-up">
            <span className="rounded-full border border-lprimary/30 dark:border-dprimary/30 bg-lprimary/10 dark:bg-dprimary/10 px-3 py-1 text-xs font-bold text-lprimary dark:text-dprimary">
              Pricing
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-black text-dark dark:text-white">
              Free to start. Pro when you outgrow it.
            </h1>
            <p className="mt-4 max-w-xl mx-auto text-dark/70 dark:text-gray">
              Host bigger rooms, build an unlimited quiz library and let AI
              draft your questions every week.
            </p>
          </div>

          <PricingPlans
            serverRegion={region}
            signedIn={Boolean(session?.user)}
          />
          <PlanComparison />
          <PricingFaq />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
