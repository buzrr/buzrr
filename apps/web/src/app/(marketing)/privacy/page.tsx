import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactEmail,
  LegalDocument,
  LegalSection,
} from "@/components/Legal/LegalDocument";
import { buildPageMetadata } from "@/lib/seo/metadata";

const TITLE = "Privacy Policy";
const DESCRIPTION =
  "What data Buzrr collects when you host, play or subscribe, why we collect it, who processes it, and how to have it deleted.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalDocument path="/privacy" title={TITLE} description={DESCRIPTION}>
      <LegalSection title="Who we are">
        <p>
          Buzrr (&ldquo;Buzrr&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an
          open-source quiz platform. This policy covers the hosted version at
          buzrr.in. Self-hosted copies of Buzrr are run by whoever deployed
          them, and their own privacy terms apply. For any privacy question or
          request, email <ContactEmail />.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Account details.</strong> When you sign in with Google we
            receive your name, email address and profile picture.
          </li>
          <li>
            <strong>Session data.</strong> To keep you signed in we store a
            session record that includes your IP address and browser user agent.
          </li>
          <li>
            <strong>Content you create.</strong> Quizzes, questions, answer
            options, images you upload, and documents you add to AI Knowledge
            Spaces.
          </li>
          <li>
            <strong>Gameplay.</strong> The nickname a player enters to join a
            room, their answers and scores, game results and history, and for
            1v1 duels your rating and match record. Players can join hosted
            rooms without an account.
          </li>
          <li>
            <strong>Billing.</strong> If you subscribe to Buzrr Pro we store
            your subscription status, plan period and payment records (amount,
            currency, status). Card and bank details are entered on our payment
            provider&apos;s page and never reach our servers.
          </li>
          <li>
            <strong>Usage and technical data.</strong> Aggregate, cookie-free
            page analytics, and IP addresses used briefly for rate limiting and
            abuse prevention.
          </li>
          <li>
            <strong>Messages.</strong> Anything you send us by email, and
            question reports you submit.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>
            To run the service: sign-in, hosting rooms, live games, duels,
            matchmaking and leaderboards.
          </li>
          <li>To generate quiz questions with AI when you ask for it.</li>
          <li>To manage Buzrr Pro subscriptions and enforce plan limits.</li>
          <li>
            To keep the service secure, prevent abuse and moderate reported
            content.
          </li>
          <li>To understand which pages are used so we can improve them.</li>
        </ul>
        <p>We do not sell your personal data and we do not show ads.</p>
      </LegalSection>

      <LegalSection title="Who processes it for us">
        <p>We share only what each service needs to do its job:</p>
        <ul>
          <li>
            <strong>Google</strong>: sign-in (OAuth), and Gemini for AI quiz
            generation. The topic, text and documents you submit for generation
            are sent to Gemini.
          </li>
          <li>
            <strong>Dodo Payments</strong>: checkout, subscription billing,
            taxes and invoices for Buzrr Pro.
          </li>
          <li>
            <strong>Cloudinary</strong>: storage and delivery of question images
            and the video on our home page.
          </li>
          <li>
            <strong>Vercel</strong>: hosting and cookie-free analytics.
          </li>
          <li>
            <strong>Upstash</strong>: rate limiting.
          </li>
          <li>Our database, cache and server hosting providers.</li>
        </ul>
        <p>
          We may also disclose data where the law requires it, or to protect the
          rights and safety of our users and the service.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          We use cookies only to keep you signed in and to secure that session.
          Your theme choice and similar preferences are kept in your
          browser&apos;s local storage. We do not use advertising or cross-site
          tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your account and content while your account exists. Live game
          state is temporary and expires once a game ends; final results are
          kept as part of your history. Payment records are kept as long as tax
          and accounting rules require. When you ask us to delete your account,
          we delete or anonymise your personal data within 30 days, except where
          we must keep it by law.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can ask us to access, correct, export or delete your personal
          data, or object to how we use it. Email <ContactEmail /> from the
          address on your account and we will reply within 30 days. You may also
          complain to your local data protection authority.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Buzrr is used in classrooms. Players can join a hosted room with just
          a nickname, so they don&apos;t need an account. Accounts are meant for
          people old enough to consent under their local law (13 in most
          countries). Teachers and hosts should not ask players to enter
          personal information as their nickname. If you believe a child has
          given us personal data without the right consent, email us and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection title="Security and transfers">
        <p>
          Data is encrypted in transit, and access to production systems is
          limited. Our providers may process data outside your country. Where
          they do, we rely on their contractual safeguards. No system is
          perfectly secure. To report a vulnerability, follow our{" "}
          <a
            href="https://github.com/buzrr/buzrr/blob/main/SECURITY.md"
            target="_blank"
            rel="noreferrer"
          >
            security policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          When this policy changes we update the date at the top of this page.
          If the change is significant, we will also tell signed-in users. See
          also our <Link href="/terms">Terms &amp; Conditions</Link>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
