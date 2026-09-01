"use client";

import { useState } from "react";
import { LuRefreshCw, LuTrash2 } from "react-icons/lu";
import { toast } from "react-toastify";
import StatusPill from "./StatusPill";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import Skeleton from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { AiDocument } from "@/lib/modules/ai/api";
import {
  useDeleteDocumentMutation,
  useRetryDocumentMutation,
} from "@/lib/modules/ai/hooks";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentList({
  spaceId,
  documents,
  isPending,
}: {
  spaceId: string;
  documents: AiDocument[];
  isPending: boolean;
}) {
  const remove = useDeleteDocumentMutation(spaceId);
  const retry = useRetryDocumentMutation(spaceId);
  const [pendingDelete, setPendingDelete] = useState<AiDocument | null>(null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            className="h-14 w-full rounded-lg bg-card-light dark:bg-dark"
          />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents yet"
        hint="Upload a PDF, DOCX, TXT or Markdown file to build this space."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {documents.map((document) => (
          <li
            key={document.id}
            className="flex items-center gap-3 rounded-lg bg-card-light dark:bg-dark px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-dark dark:text-white">
                {document.filename}
              </p>
              <p className="text-2xs text-off-dark dark:text-off-white">
                {humanSize(document.sizeBytes)}
                {document.pageCount ? ` · ${document.pageCount} pages` : ""}
                {document.status === "ready"
                  ? ` · ${document.chunkCount} chunks`
                  : ""}
              </p>
              {document.status === "failed" && document.error && (
                <p className="mt-1 text-2xs text-red-light dark:text-red-dark">
                  {document.error}
                </p>
              )}
            </div>

            <StatusPill status={document.status} />

            {document.status === "failed" && (
              <button
                type="button"
                aria-label={`Retry ${document.filename}`}
                disabled={retry.isPending}
                onClick={() =>
                  retry.mutate(document.id, {
                    onError: (error) => toast.error(getApiErrorMessage(error)),
                  })
                }
                className="p-1.5 rounded-md text-off-dark dark:text-off-white hover:bg-white dark:hover:bg-card-dark disabled:opacity-50"
              >
                <LuRefreshCw size={15} />
              </button>
            )}

            <button
              type="button"
              aria-label={`Delete ${document.filename}`}
              disabled={remove.isPending}
              onClick={() => setPendingDelete(document)}
              className="p-1.5 rounded-md text-off-dark dark:text-off-white hover:text-red-light dark:hover:text-red-dark disabled:opacity-50"
            >
              <LuTrash2 size={15} />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmationModal
        open={pendingDelete !== null}
        setOpen={(next) => {
          if (!next) setPendingDelete(null);
        }}
        desc={
          pendingDelete
            ? `Delete “${pendingDelete.filename}”? Everything indexed from it is removed, so answers can no longer cite it. Quizzes you already exported are not affected.`
            : undefined
        }
        confirmLabel="Delete"
        confirming={remove.isPending}
        confirmingLabel="Deleting…"
        onClick={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, {
            onSuccess: () => toast.success("Document deleted"),
            onError: (error) => toast.error(getApiErrorMessage(error)),
            // Keep the modal up (and locked) until the request settles, so the
            // confirm button can show its in-flight state.
            onSettled: () => setPendingDelete(null),
          });
        }}
      />
    </>
  );
}
