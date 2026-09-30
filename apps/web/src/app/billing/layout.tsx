import LandingNavbar from "@/components/Landing/LandingNavbar";
import ToastViewport from "@/components/ToastViewport";

import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// App screens, not landing pages: keep them out of search results.
export const metadata = NOINDEX_METADATA;

export default function BillingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh flex flex-col bg-light-bg dark:bg-dark-bg">
      <LandingNavbar />
      <main className="flex-1 px-4 sm:px-6 py-12 md:py-20">{children}</main>
      <ToastViewport />
    </div>
  );
}
