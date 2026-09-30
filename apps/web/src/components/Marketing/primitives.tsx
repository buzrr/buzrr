import Link from "next/link";
import { LuArrowRight, LuChevronRight } from "react-icons/lu";
import {
  breadcrumbSchema,
  serializeJsonLd,
  type Crumb,
} from "@/lib/seo/json-ld";

/**
 * Server-only building blocks for the SEO/marketing pages under
 * `app/(marketing)`. They ship no client JavaScript; styling follows the
 * landing page (tokens from globals.css, both themes styled by hand).
 */

export function JsonLd({ nodes }: { nodes: Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(nodes) }}
    />
  );
}

/** Visible breadcrumb trail. Pair with `breadcrumbSchema` in the page graph. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-dark/60 dark:text-gray">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="text-dark dark:text-white">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link
                    href={crumb.path}
                    className="hover:text-lprimary dark:hover:text-dprimary transition-colors"
                  >
                    {crumb.name}
                  </Link>
                  <LuChevronRight size={14} aria-hidden />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { breadcrumbSchema };

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      {children}
    </div>
  );
}

interface CtaLink {
  label: string;
  href: string;
}

export function PageHero({
  crumbs,
  eyebrow,
  title,
  lead,
  primary,
  secondary,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  lead: string;
  primary?: CtaLink;
  secondary?: CtaLink;
}) {
  return (
    <header className="pt-8 pb-10 sm:pt-10 sm:pb-12">
      <Breadcrumbs crumbs={crumbs} />
      <p className="mt-8 inline-flex rounded-full border border-lprimary/30 dark:border-dprimary/30 bg-lprimary/10 dark:bg-dprimary/10 px-3 py-1 text-xs font-bold text-lprimary dark:text-dprimary">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-3xl sm:text-5xl font-black text-dark dark:text-white leading-tight max-w-3xl">
        {title}
      </h1>
      <p className="mt-5 text-base sm:text-lg text-dark/70 dark:text-gray max-w-2xl">
        {lead}
      </p>
      {(primary || secondary) && (
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {primary && <PrimaryButton {...primary} />}
          {secondary && <SecondaryButton {...secondary} />}
        </div>
      )}
    </header>
  );
}

function isExternal(href: string) {
  return /^https?:\/\//.test(href);
}

export function PrimaryButton({ label, href }: CtaLink) {
  const className =
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90 transition-opacity";
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
      <LuArrowRight size={16} aria-hidden />
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
      <LuArrowRight size={16} aria-hidden />
    </Link>
  );
}

export function SecondaryButton({ label, href }: CtaLink) {
  const className =
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary hover:bg-lprimary/10 dark:hover:bg-dprimary/10 transition-colors";
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function Section({
  id,
  title,
  intro,
  children,
}: {
  id?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="py-10 border-t border-card-light dark:border-card-dark"
    >
      <h2 className="text-2xl sm:text-3xl font-black text-dark dark:text-white">
        {title}
      </h2>
      {intro && (
        <p className="mt-3 text-dark/70 dark:text-gray max-w-3xl">{intro}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-4 max-w-3xl text-dark/80 dark:text-off-white leading-relaxed">
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

export function PointGrid({
  points,
}: {
  points: { title: string; text: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {points.map((point) => (
        <div
          key={point.title}
          className="rounded-xl border border-card-light dark:border-off-dark bg-white dark:bg-dark p-5"
        >
          <h3 className="font-bold text-dark dark:text-white">{point.title}</h3>
          <p className="mt-2 text-sm text-dark/70 dark:text-gray leading-relaxed">
            {point.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export function BulletList({
  items,
  tone = "neutral",
}: {
  items: string[];
  tone?: "neutral" | "positive" | "caution";
}) {
  const marker =
    tone === "positive"
      ? "bg-lprimary dark:bg-dprimary"
      : tone === "caution"
        ? "bg-red-light dark:bg-red-dark"
        : "bg-dark/40 dark:bg-gray";
  return (
    <ul className="space-y-2.5 max-w-3xl">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-dark/80 dark:text-off-white leading-relaxed"
        >
          <span
            aria-hidden
            className={`mt-2.5 size-1.5 shrink-0 rounded-full ${marker}`}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Steps({
  steps,
}: {
  steps: { title?: string; text: string }[];
}) {
  return (
    <ol className="space-y-4 max-w-3xl">
      {steps.map((step, i) => (
        <li key={step.text} className="flex gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lprimary/10 dark:bg-dprimary/10 text-sm font-black text-lprimary dark:text-dprimary">
            {i + 1}
          </span>
          <p className="min-w-0 pt-1 text-dark/80 dark:text-off-white leading-relaxed wrap-anywhere">
            {step.title && (
              <strong className="text-dark dark:text-white">
                {step.title}.{" "}
              </strong>
            )}
            {step.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** A self-contained question and answer, as plain visible text. */
export function Answer({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-lprimary/30 dark:border-dprimary/30 bg-lprimary/5 dark:bg-dprimary/5 p-6">
      <h2 className="text-lg sm:text-xl font-black text-dark dark:text-white">
        {question}
      </h2>
      <div className="mt-3 text-dark/80 dark:text-off-white leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export interface LinkCardItem {
  href: string;
  title: string;
  text: string;
}

export function LinkCards({ items }: { items: LinkCardItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="group flex h-full flex-col rounded-xl border border-card-light dark:border-off-dark bg-white dark:bg-dark p-5 hover:border-lprimary/50 dark:hover:border-dprimary/50 transition-colors"
          >
            <span className="flex items-center justify-between gap-2 font-bold text-dark dark:text-white group-hover:text-lprimary dark:group-hover:text-dprimary transition-colors">
              {item.title}
              <LuArrowRight size={16} aria-hidden className="shrink-0" />
            </span>
            <span className="mt-2 text-sm text-dark/70 dark:text-gray leading-relaxed">
              {item.text}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CtaPanel({
  title,
  text,
  primary,
  secondary,
}: {
  title: string;
  text: string;
  primary: CtaLink;
  secondary?: CtaLink;
}) {
  return (
    <section className="mt-10 rounded-2xl border border-card-light dark:border-off-dark bg-white dark:bg-dark p-6 sm:p-10 text-center">
      <h2 className="text-2xl sm:text-3xl font-black text-dark dark:text-white">
        {title}
      </h2>
      <p className="mt-3 max-w-xl mx-auto text-dark/70 dark:text-gray">
        {text}
      </p>
      <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
        <PrimaryButton {...primary} />
        {secondary && <SecondaryButton {...secondary} />}
      </div>
    </section>
  );
}
