"use client";

import clsx from "clsx";
import { useCallback, useRef, useState } from "react";
import { LuUpload, LuX } from "react-icons/lu";
import { toast } from "react-toastify";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useUploadDocumentsMutation } from "@/lib/modules/ai/hooks";

const ACCEPT = ".pdf,.docx,.txt,.md";
const ALLOWED = [".pdf", ".docx", ".txt", ".md"];
const MAX_FILES = 10;
const MAX_MB = 5;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Multi-file picker with drag-and-drop.
 *
 * Validates extension and size client-side purely as fast feedback — the AI
 * service enforces both again, since a browser check is not a control.
 */
export default function DocumentUploader({ spaceId }: { spaceId: string }) {
  const [staged, setStaged] = useState<File[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useUploadDocumentsMutation(spaceId);

  const accept = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const next: File[] = [];
    for (const file of Array.from(incoming)) {
      if (!ALLOWED.includes(extensionOf(file.name))) {
        toast.error(
          `${file.name}: only PDF, DOCX, TXT and Markdown are supported`,
        );
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name}: larger than ${MAX_MB}MB`);
        continue;
      }
      next.push(file);
    }
    setStaged((current) => {
      const merged = [...current];
      for (const file of next) {
        if (!merged.some((f) => f.name === file.name && f.size === file.size)) {
          merged.push(file);
        }
      }
      if (merged.length > MAX_FILES) {
        toast.error(`At most ${MAX_FILES} files at a time`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }, []);

  function reset() {
    setStaged([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit() {
    if (staged.length === 0) return;
    mutation.mutate(staged, {
      onSuccess: (documents) => {
        toast.success(
          documents.length === 1
            ? "Uploaded — processing now"
            : `${documents.length} files uploaded — processing now`,
        );
        reset();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "rounded-xl border border-dashed p-6 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-lprimary dark:border-dprimary bg-card-light dark:bg-dark"
            : "border-gray hover:bg-card-light dark:hover:bg-dark",
        )}
      >
        <LuUpload
          size={22}
          className="mx-auto text-lprimary dark:text-dprimary"
          aria-hidden
        />
        <p className="mt-2 font-bold text-dark dark:text-white">
          Drop files here, or click to choose
        </p>
        <p className="mt-1 text-xs text-off-dark dark:text-off-white">
          PDF, DOCX, TXT or Markdown · up to {MAX_MB}MB each · {MAX_FILES} at a
          time
        </p>
        <p className="mt-2 text-2xs text-off-dark dark:text-off-white">
          Text is sent to Google Gemini for indexing. Your original file is
          deleted once processing finishes.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => accept(event.target.files)}
        />
      </div>

      {staged.length > 0 && (
        <div className="mt-3">
          <ul className="flex flex-wrap gap-2">
            {staged.map((file) => (
              <li
                key={`${file.name}-${file.size}`}
                className="flex items-center gap-2 rounded-md bg-card-light dark:bg-dark px-2 py-1 text-xs text-dark dark:text-white"
              >
                <span className="max-w-[16rem] truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setStaged((current) => current.filter((f) => f !== file))
                  }
                  className="text-off-dark dark:text-off-white hover:text-red-light dark:hover:text-red-dark"
                >
                  <LuX size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={submit}
              isLoading={mutation.isPending}
              loadingText="Uploading..."
            >
              Upload {staged.length} file{staged.length === 1 ? "" : "s"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmClear(true)}
              disabled={mutation.isPending}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={confirmClear}
        setOpen={setConfirmClear}
        desc={
          `Discard all ${staged.length} file${staged.length === 1 ? "" : "s"} you picked? ` +
          "Nothing has been uploaded yet, so you would need to choose them again."
        }
        confirmLabel="Discard"
        onClick={() => {
          reset();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}
