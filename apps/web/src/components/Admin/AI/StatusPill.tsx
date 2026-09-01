"use client";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { DocumentStatus } from "@/lib/modules/ai/api";

const TONE: Record<DocumentStatus, BadgeTone> = {
  queued: "neutral",
  processing: "warning",
  ready: "success",
  failed: "danger",
};

const LABEL: Record<DocumentStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export default function StatusPill({ status }: { status: DocumentStatus }) {
  return (
    <Badge tone={TONE[status]}>
      {status === "processing" && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse"
          aria-hidden
        />
      )}
      {LABEL[status]}
    </Badge>
  );
}
