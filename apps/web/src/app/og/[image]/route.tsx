import { MARKETING_PAGES } from "@/data/marketing/pages";
import { renderSocialCard } from "@/lib/seo/og-image";

/**
 * Social cards for the marketing pages, rendered once at build time:
 * `/og/alternatives-kahoot.png` etc. Keys come from the page registry, so an
 * unknown key 404s instead of rendering on demand.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETING_PAGES.map((page) => ({ image: `${page.ogKey}.png` }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ image: string }> },
) {
  const { image } = await params;
  const page = MARKETING_PAGES.find((p) => `${p.ogKey}.png` === image);
  if (!page) return new Response("Not found", { status: 404 });
  return renderSocialCard({ eyebrow: page.ogEyebrow, title: page.ogTitle });
}
