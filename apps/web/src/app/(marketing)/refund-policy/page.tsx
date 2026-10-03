import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactEmail,
  LegalDocument,
  LegalSection,
} from "@/components/Legal/LegalDocument";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Refund & Cancellation Policy";
const DESCRIPTION =
  "Buzrr Pro payments are non-refundable. If you cancel, you keep Pro until the end of the month you've already paid for.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      path="/refund-policy"
      title={TITLE}
      description={DESCRIPTION}
    >
      <LegalSection title="No refunds">
        <p>
          <strong>All Buzrr Pro payments are final and non-refundable.</strong>{" "}
          This covers new subscriptions, renewals, partial months, unused
          features and unused AI generations. We do not refund or credit any
          part of a billing period, including when you cancel partway through
          it, downgrade, or stop using Buzrr.
        </p>
        <p>
          The Free plan is always available, so you can try Buzrr before you
          pay. Check the <Link href="/pricing">pricing page</Link> to make sure
          Pro fits your needs before you subscribe.
        </p>
      </LegalSection>

      <LegalSection title="Cancelling Buzrr Pro">
        <p>
          You can cancel any time from <strong>Plan &amp; Billing</strong> in
          your account. Cancelling stops the next renewal. It does not end your
          current month.
        </p>
        <p>
          <strong>
            Once you buy Pro, you keep it until the end of the monthly billing
            period you paid for, even if you cancel.
          </strong>{" "}
          Your account then moves to the Free plan automatically. You won&apos;t
          be charged again.
        </p>
        <p>
          Nothing is deleted when you move to Free. You can still host every
          quiz you made. If you have more quizzes than the Free plan allows, you
          will need to delete some before you can create new ones.
        </p>
      </LegalSection>

      <LegalSection title="Failed payments">
        <p>
          If a renewal payment fails, we retry it. Until it goes through, your
          account uses Free plan limits. Once you update your payment method and
          the payment succeeds, Pro comes back straight away.
        </p>
      </LegalSection>

      <LegalSection title="Billing errors">
        <p>
          If you think you were charged by mistake, email <ContactEmail /> with
          your account email and the payment date. We will look into it. Please
          contact us before opening a dispute with your bank.
        </p>
        <p>
          This policy does not limit any rights you have under consumer law that
          cannot be waived.
        </p>
      </LegalSection>

      <LegalSection title="Related">
        <p>
          This policy is part of our{" "}
          <Link href="/terms">Terms &amp; Conditions</Link>. Payments are
          processed by Dodo Payments.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
