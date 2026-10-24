import SoloPlayClient from "@/components/Solo/SoloPlayClient";
import ToastViewport from "@/components/ToastViewport";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";
import "../../player/styles.css";

// App screens, not landing pages: keep them out of search results.
export const metadata = NOINDEX_METADATA;

export default async function SoloPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <div className="flex flex-col h-full">
      <SoloPlayClient code={code} />
      <ToastViewport />
    </div>
  );
}
