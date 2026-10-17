import type { Metadata, Viewport } from "next";
import clsx from "clsx";
import { IBM_Plex_Sans } from "next/font/google";
import ReduxProvider from "@/state/ReduxProvider";
import QueryProvider from "@/providers/QueryProvider";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Analytics } from "@vercel/analytics/next";
import Footer from "@/components/Footer";
import VersionWatcher from "@/components/VersionWatcher";
import {
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_URL,
  defaultTitle,
  siteName,
} from "@/lib/seo/site";
import { getInstanceConfig } from "@/lib/instance";
import { InstanceProvider } from "@/lib/instance-context";
import { I18nProvider } from "@/lib/i18n/context";
import { getLocale } from "@/lib/i18n/server";

// Instance options (TITLE, PRIVATE_BUZZ, …) come from the environment at
// request time, so nothing is frozen at build.
export const dynamic = "force-dynamic";
import "./globals.css";

/**
 * Site-wide defaults only. Canonical URLs are per page (`buildPageMetadata`) —
 * a canonical here would be inherited by every page that forgets its own and
 * point it at the homepage. Social images come from the `opengraph-image.png`
 * / `twitter-image.png` files next to this layout unless a page sets its own.
 */
export function generateMetadata(): Metadata {
  const SITE_NAME = siteName();
  const DEFAULT_TITLE = defaultTitle();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    authors: [{ name: "Buzrr contributors", url: REPO_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "education",
    formatDetection: { telephone: false, email: false, address: false },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: SITE_URL,
      title: DEFAULT_TITLE,
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: SITE_DESCRIPTION,
    },
    appleWebApp: { title: SITE_NAME },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body
        className={clsx(
          sans.className,
          "bg-light-bg dark:bg-dark-bg h-fit overflow-x-hidden",
        )}
      >
        <I18nProvider locale={locale}>
          <InstanceProvider config={getInstanceConfig()}>
            <ReduxProvider>
              <QueryProvider>
                {children}
                <ReactQueryDevtools
                  initialIsOpen={false}
                  buttonPosition="top-right"
                />
                <Footer />
                <VersionWatcher />
              </QueryProvider>
            </ReduxProvider>
          </InstanceProvider>
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
