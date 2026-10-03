import Link from "next/link";
import { PLAN_COPY } from "@/lib/pricing";

const FAQS = [
  {
    q: "What counts as an AI generation?",
    a: "Each request that asks AI to write questions uses one — “Create a quiz with AI” or a generation in an AI Knowledge Space. If a generation fails, it’s refunded automatically.",
  },
  {
    q: "When do my weekly AI generations refill?",
    a: `On Pro you get ${PLAN_COPY.pro.aiTokensPerWeek} generations in a 7-day window that starts with your first generation. When the window ends, your next generation starts a fresh one. The Free plan’s ${PLAN_COPY.free.aiTokens} generations are a one-time allowance.`,
  },
  {
    q: "What happens if I cancel?",
    a: `You keep Pro until the end of the period you’ve paid for, then move to Free. Nothing is deleted: if you have more than ${PLAN_COPY.free.maxQuizzes} quizzes you can still host all of them, but you’ll need to delete some before creating new ones.`,
  },
  {
    q: "Can I get a refund?",
    a: (
      <>
        No. Pro payments are non-refundable, including partial months. If you
        cancel, Pro stays active until the end of the month you’ve paid for.
        Details are in our{" "}
        <Link
          href="/refund-policy"
          className="text-lprimary dark:text-dprimary underline underline-offset-2"
        >
          Refund &amp; Cancellation Policy
        </Link>
        .
      </>
    ),
  },
  {
    q: "What if a payment fails?",
    a: "We’ll retry, and your account uses Free limits until the payment goes through. Update your payment method from the Plan & Billing page and Pro comes back straight away.",
  },
  {
    q: "Which currency will I pay in?",
    a: "Pro is priced in Indian rupees for billing addresses in India and in US dollars everywhere else. The exact amount, including any taxes and discounts, is confirmed at checkout.",
  },
  {
    q: "Can I use a discount code?",
    a: "Yes. Running promotions are applied automatically, and you can enter a code on the checkout page.",
  },
  {
    q: "Is Buzrr still open source?",
    a: "Yes. Pro pays for the hosted version’s infrastructure. Self-hosted instances run without billing, and every account there gets Pro limits.",
  },
];

export default function PricingFaq() {
  return (
    <section className="mt-20">
      <h2 className="text-2xl font-black text-center text-dark dark:text-white">
        Questions, answered
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {FAQS.map((faq) => (
          <div
            key={faq.q}
            className="rounded-2xl bg-white dark:bg-card-dark p-6"
          >
            <h3 className="font-bold text-dark dark:text-white">{faq.q}</h3>
            <p className="mt-2 text-sm text-off-dark dark:text-off-white">
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
