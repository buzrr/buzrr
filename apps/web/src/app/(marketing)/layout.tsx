import LandingNavbar from "@/components/Landing/LandingNavbar";
import LandingFooter from "@/components/Landing/LandingFooter";

/**
 * Chrome for the static SEO pages (alternatives, comparisons, use cases,
 * open-source/self-hosting). Server-rendered; the navbar is the only client
 * component. The root `Footer` bar skips these paths (see Footer.tsx).
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh flex flex-col bg-light-bg dark:bg-dark-bg">
      <LandingNavbar />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
