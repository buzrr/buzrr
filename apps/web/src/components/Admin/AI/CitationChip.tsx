"use client";

import { LuFileText } from "react-icons/lu";
import type { Citation } from "@/lib/modules/ai/api";

function pageLabel(citation: Citation): string | null {
  if (!citation.pageStart) return null;
  if (!citation.pageEnd || citation.pageEnd === citation.pageStart) {
    return `p.${citation.pageStart}`;
  }
  return `pp.${citation.pageStart}–${citation.pageEnd}`;
}

/**
 * Where a generated question came from. Rendered from the snapshot stored on the
 * citation, so it still reads correctly after the source document is re-ingested.
 */
export default function CitationChip({ citation }: { citation: Citation }) {
  const page = pageLabel(citation);
  const section = citation.headingPath.join(" › ");

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-card-light dark:bg-dark px-2 py-1 text-2xs text-off-dark dark:text-off-white max-w-full"
      title={[citation.documentName, section, page].filter(Boolean).join(" — ")}
    >
      <LuFileText size={12} className="shrink-0" aria-hidden />
      <span className="truncate font-bold text-dark dark:text-white">
        {citation.documentName}
      </span>
      {section && <span className="truncate">· {section}</span>}
      {page && <span className="shrink-0">· {page}</span>}
    </span>
  );
}
