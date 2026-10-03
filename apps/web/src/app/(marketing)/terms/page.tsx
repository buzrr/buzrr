import type { Metadata } from "next";
import Link from "next/link";
import { LICENSE_LINK } from "@/components/Landing/links";
import {
  ContactEmail,
  LegalDocument,
  LegalSection,
} from "@/components/Legal/LegalDocument";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Terms & Conditions";
const DESCRIPTION =
  "The terms for using the hosted Buzrr service: accounts, acceptable use, your content, AI features and Buzrr Pro subscriptions.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalDocument path="/terms" title={TITLE} description={DESCRIPTION}>
      <LegalSection title="Agreement">
        <p>
          These terms apply when you use the hosted Buzrr service at buzrr.in
          (&ldquo;the Service&rdquo;). By using the Service you agree to them,
          and to our <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
          If you don&apos;t agree, please don&apos;t use the Service.
        </p>
        <p>
          Buzrr&apos;s source code is licensed separately under{" "}
          <a href={LICENSE_LINK} target="_blank" rel="noreferrer">
            GPL-3.0
          </a>
          . These terms cover the hosted Service only. They do not restrict what
          the license lets you do with the code.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <ul>
          <li>
            Hosting quizzes, playing 1v1 duels, and using AI features or Buzrr
            Pro all need an account. You create one by signing in with Google.
          </li>
          <li>
            You are responsible for activity on your account and for keeping
            your Google account secure.
          </li>
          <li>
            You must be old enough to agree to these terms under your local law.
            If you are not, a parent or guardian must agree for you.
          </li>
          <li>
            Players can join a hosted room without an account. The room&apos;s
            host is responsible for how they run their room.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>
            post content that is illegal or hateful, that harasses people, that
            is sexually explicit, or that infringes anyone&apos;s rights;
          </li>
          <li>
            cheat in duels or ranked play, use bots or scripts to play, or
            manipulate ratings or leaderboards;
          </li>
          <li>
            disrupt, overload or probe the Service, or bypass rate limits or
            plan limits;
          </li>
          <li>access other users&apos; accounts or data without permission;</li>
          <li>resell or sublicense access to the hosted Service.</li>
        </ul>
        <p>
          We may remove content, unapprove questions, or suspend or close
          accounts that break these rules.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You keep ownership of the quizzes, questions, images and documents you
          create or upload. You give us a limited license to store, process and
          display that content so we can run the Service. For example, we show
          your questions to players in your rooms, and we send your material to
          our AI provider when you ask for generation. Questions in quizzes you
          make public may be approved by our moderators. Approved questions are
          shown to other players in 1v1 duels.
        </p>
        <p>You confirm that you have the rights to everything you upload.</p>
      </LegalSection>

      <LegalSection title="AI-generated content">
        <p>
          AI-generated questions can be wrong, incomplete or biased. Review them
          before you use them. You are responsible for the quizzes you publish
          and host.
        </p>
      </LegalSection>

      <LegalSection title="Buzrr Pro subscriptions">
        <ul>
          <li>
            Buzrr Pro is a monthly subscription. Your plan, price and limits are
            shown on the <Link href="/pricing">pricing page</Link> and confirmed
            at checkout.
          </li>
          <li>
            Your subscription renews automatically each month until you cancel.
            Dodo Payments processes payments and may act as the merchant of
            record.
          </li>
          <li>
            <strong>Payments are non-refundable.</strong> If you cancel, you
            keep Pro until the end of the monthly period you paid for, and your
            account then moves to Free. See the{" "}
            <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
          </li>
          <li>
            We may change prices or plan limits. A price change takes effect at
            your next renewal, after we give you notice.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          Buzrr is in public beta. We work to keep it running, but we don&apos;t
          guarantee that it will be available without interruption or errors. We
          may add, change or remove features at any time.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer and liability">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind. As far as the law
          allows, we are not liable for indirect, incidental or consequential
          losses, or for loss of data or profits. Our total liability for any
          claim about the Service is capped at the amount you paid us in the 12
          months before the claim. Nothing in these terms limits liability that
          the law does not allow us to limit.
        </p>
      </LegalSection>

      <LegalSection title="Ending your use">
        <p>
          You can stop using the Service at any time. To have your account
          deleted, email <ContactEmail />. We may suspend or close accounts that
          break these terms.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of India. Disputes will go to the
          courts of India, unless your local consumer law gives you the right to
          bring a claim where you live.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          When we change these terms, we update the date at the top of this
          page. If you keep using the Service after a change, you accept the new
          terms. Questions? Email <ContactEmail />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
