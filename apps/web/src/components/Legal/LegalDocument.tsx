import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/Landing/links";
import {
  Breadcrumbs,
  JsonLd,
  PageContainer,
  breadcrumbSchema,
} from "@/components/Marketing/primitives";
import { LEGAL_PAGES, LEGAL_UPDATED } from "@/data/legal";
import { webPageSchema } from "@/lib/seo/json-ld";

/**
 * Shared shell for the legal pages (privacy, terms, refunds). Server-only;
 * styling follows the marketing pages.
 */

export function LegalDocument({
  path,
  title,
  description,
  children,
}: {
  path: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: title, path },
  ];
  return (
    <PageContainer>
      <JsonLd
        nodes={[
          webPageSchema({ path, title, description }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <header className="pt-8 pb-8 sm:pt-10">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="mt-8 text-3xl sm:text-5xl font-black text-dark dark:text-white leading-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm font-semibold text-dark/60 dark:text-gray">
          Last updated: {LEGAL_UPDATED}
        </p>
        <p className="mt-5 text-base sm:text-lg text-dark/70 dark:text-gray max-w-3xl">
          {description}
        </p>
      </header>

      <div className="space-y-2">{children}</div>

      <nav
        aria-label="Legal"
        className="mt-10 pt-6 border-t border-card-light dark:border-card-dark flex flex-wrap gap-x-6 gap-y-2 text-sm"
      >
        {LEGAL_PAGES.filter((page) => page.path !== path).map((page) => (
          <Link
            key={page.path}
            href={page.path}
            className="text-lprimary dark:text-dprimary underline underline-offset-2"
          >
            {page.name}
          </Link>
        ))}
      </nav>
    </PageContainer>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-8 border-t border-card-light dark:border-card-dark">
      <h2 className="text-xl sm:text-2xl font-black text-dark dark:text-white">
        {title}
      </h2>
      <div className="mt-4 space-y-4 max-w-3xl text-dark/80 dark:text-off-white leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-lprimary dark:[&_a]:text-dprimary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-dark dark:[&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}

export function ContactEmail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}
