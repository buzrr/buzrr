"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRef, useState } from "react";
import { LuDownload, LuFileJson, LuFileSpreadsheet } from "react-icons/lu";
import { toast } from "react-toastify";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import CategoryChips from "@/components/Admin/CategoryChips";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCategoriesQuery } from "@/lib/modules/categories/hooks";
import { useCreateStandaloneQuestionsMutation } from "@/lib/modules/moderation/hooks";
import { queryKeys } from "@/lib/modules/query-keys";
import {
  MAX_UPLOAD_ROWS,
  parseQuestionRows,
  type ParseResult,
} from "./parseQuestionRows";

/** Questions per request: each is one server transaction, kept well short. */
const UPLOAD_CHUNK = 100;
const PREVIEW_ROWS = 20;

type Format = "excel" | "csv";

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; done: number; total: number }
  | { kind: "done"; created: number }
  | { kind: "failed"; created: number; fromRow: number; message: string };

function readRows(
  file: File,
  format: Format,
): Promise<Record<string, unknown>[]> {
  if (format === "csv" || file.name.toLowerCase().endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const error = results.errors[0];
          if (error) {
            reject(
              new Error(
                `${error.message}${error.row !== undefined ? ` at row ${error.row + 2}` : ""}`,
              ),
            );
          } else {
            resolve(results.data);
          }
        },
        error: (error) => reject(error),
      });
    });
  }
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet) throw new Error("The workbook has no sheets");
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
  });
}

export default function BulkUploadClient() {
  const [format, setFormat] = useState<Format>("excel");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categories = useCategoriesQuery();
  const create = useCreateStandaloneQuestionsMutation();
  const queryClient = useQueryClient();

  const uploading = upload.kind === "uploading";

  const resetFile = () => {
    setFileName(null);
    setParsed(null);
    setUpload({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    setUpload({ kind: "idle" });
    setParsed(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    setIsParsing(true);
    try {
      const result = parseQuestionRows(await readRows(file, format));
      setParsed(result);
      if (result.valid.length === 0 && result.errors.length === 0) {
        toast.error(
          "No questions found. Make sure the file uses the template.",
        );
      }
    } catch (err) {
      setParsed(null);
      toast.error(
        `Could not read the file: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpload = async () => {
    // A failed upload may have committed earlier chunks; only a new file
    // (which resets `upload`) can be submitted again.
    if (!parsed || parsed.valid.length === 0 || upload.kind !== "idle") return;
    const questions = parsed.valid;
    let created = 0;
    setUpload({ kind: "uploading", done: 0, total: questions.length });
    for (let i = 0; i < questions.length; i += UPLOAD_CHUNK) {
      const part = questions.slice(i, i + UPLOAD_CHUNK);
      try {
        const result = await create.mutateAsync(
          part.map((q) => ({
            type: q.type,
            title: q.title,
            options: q.options,
            timeOut: q.timeOut,
            categoryIds,
          })),
        );
        created += result.created;
        setUpload({
          kind: "uploading",
          done: created,
          total: questions.length,
        });
      } catch (err) {
        setUpload({
          kind: "failed",
          created,
          fromRow: part[0]!.row,
          message: getApiErrorMessage(err),
        });
        // Let re-selecting the same (edited) file fire `onChange`.
        if (fileInputRef.current) fileInputRef.current.value = "";
        void queryClient.invalidateQueries({
          queryKey: queryKeys.moderation.all,
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.categories.all,
        });
        return;
      }
    }
    setUpload({ kind: "done", created });
    toast.success(`Uploaded ${created} question${created === 1 ? "" : "s"}`);
    void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
  };

  const noCategories = categories.isSuccess && categories.data.length === 0;
  const canUpload =
    !!parsed &&
    parsed.valid.length > 0 &&
    categoryIds.length > 0 &&
    upload.kind === "idle";

  return (
    <div className="mt-4 flex max-w-3xl flex-col gap-6 text-dark dark:text-white">
      <p className="text-sm text-off-dark dark:text-off-white">
        Upload hundreds of duel questions at once. They go into the Pending tab
        for review; only single-answer multiple choice and true / false
        questions can be used in duels.
      </p>

      <Step n={1} title="Pick the category">
        {noCategories ? (
          <p className="text-sm">
            No categories yet —{" "}
            <Link
              href="/admin/duel-portal/categories"
              className="font-semibold text-lprimary dark:text-dprimary"
            >
              create one first
            </Link>
            .
          </p>
        ) : (
          <>
            <CategoryChips
              value={categoryIds}
              onChange={setCategoryIds}
              disabled={uploading}
            />
            <p className="text-xs text-off-dark dark:text-off-white">
              Every question in the file gets the selected categories.
            </p>
          </>
        )}
      </Step>

      <Step n={2} title="Download the template">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-lprimary/5 dark:bg-white/5 p-1">
            {(
              [
                {
                  value: "excel",
                  label: "Excel",
                  icon: <LuFileSpreadsheet size={16} />,
                },
                { value: "csv", label: "CSV", icon: <LuFileJson size={16} /> },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={uploading}
                onClick={() => {
                  setFormat(option.value);
                  resetFile();
                }}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                  format === option.value
                    ? "bg-white dark:bg-card-dark shadow-sm text-lprimary dark:text-dprimary"
                    : "text-dark/60 dark:text-white/60 hover:text-dark dark:hover:text-white",
                )}
              >
                {option.icon} {option.label}
              </button>
            ))}
          </div>
          <a
            href={`/sample-questions.${format === "excel" ? "xlsx" : "csv"}`}
            download
            className="flex items-center gap-2 rounded-xl border border-lprimary/20 dark:border-white/20 bg-white dark:bg-white/10 px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-lprimary/5 dark:hover:bg-white/20"
          >
            <LuDownload size={16} />
            Download {format === "excel" ? "Excel" : "CSV"} template
          </a>
        </div>
        <ul className="list-disc pl-5 text-xs text-off-dark dark:text-off-white space-y-0.5">
          <li>
            <b>Type</b>: MCQ (default) or True/False.
          </li>
          <li>
            <b>Correct Option</b>: 1–4 for MCQ, True or False for True/False —
            exactly one right answer.
          </li>
          <li>
            <b>Time Limit (sec)</b> is optional. Up to {MAX_UPLOAD_ROWS} rows
            per file.
          </li>
        </ul>
      </Step>

      <Step n={3} title="Upload the filled file">
        <input
          ref={fileInputRef}
          type="file"
          accept={format === "excel" ? ".xlsx, .xls" : ".csv"}
          onChange={(e) => void handleFile(e.target.files?.[0])}
          disabled={uploading || isParsing}
          className="block w-full text-sm text-dark/70 dark:text-white/70
            file:mr-4 file:py-2.5 file:px-4
            file:rounded-xl file:border-0
            file:text-sm file:font-semibold
            file:bg-lprimary/10 file:text-lprimary
            dark:file:bg-dprimary/20 dark:file:text-dprimary
            hover:file:bg-lprimary/20 dark:hover:file:bg-dprimary/30
            transition-all file:cursor-pointer cursor-pointer disabled:opacity-50"
        />
        {isParsing && <p className="text-sm">Reading {fileName}…</p>}
        {parsed && <Preview parsed={parsed} />}
      </Step>

      {upload.kind === "uploading" && (
        <div className="flex flex-col gap-2">
          <Progress
            value={upload.done}
            max={upload.total}
            label="Upload progress"
          />
          <p className="text-sm tabular-nums">
            Uploaded {upload.done} / {upload.total}
          </p>
        </div>
      )}
      {upload.kind === "failed" && (
        <p className="rounded-xl bg-red-light/10 dark:bg-red-dark/10 p-3 text-sm text-red-light dark:text-red-dark">
          Upload stopped at the batch starting on row {upload.fromRow}:{" "}
          {upload.message}. {upload.created} question
          {upload.created === 1 ? " was" : "s were"} saved before it. To
          continue, remove those rows and select the edited file.
        </p>
      )}
      {upload.kind === "done" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#20A97C]/10 p-3 text-sm">
          <span className="font-semibold text-[#20A97C]">
            Uploaded {upload.created} question{upload.created === 1 ? "" : "s"}.
          </span>
          <Link
            href="/admin/duel-portal?status=pending"
            className="font-semibold text-lprimary dark:text-dprimary"
          >
            Review pending questions →
          </Link>
          <button
            type="button"
            onClick={resetFile}
            className="cursor-pointer font-semibold text-off-dark dark:text-off-white"
          >
            Upload another file
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={() => void handleUpload()}
          disabled={!canUpload}
          isLoading={uploading}
          loadingText="Uploading…"
        >
          Upload {parsed?.valid.length ? parsed.valid.length : ""} question
          {parsed?.valid.length === 1 ? "" : "s"}
        </Button>
        {parsed && parsed.valid.length > 0 && categoryIds.length === 0 && (
          <span className="text-sm text-off-dark dark:text-off-white">
            Pick a category first.
          </span>
        )}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lprimary/10 dark:bg-dprimary/20 text-xs text-lprimary dark:text-dprimary">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Preview({ parsed }: { parsed: ParseResult }) {
  const { valid, errors, truncated } = parsed;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">
        <span className="text-[#20A97C]">{valid.length} valid</span>
        {errors.length > 0 && (
          <span className="text-red-light dark:text-red-dark">
            {" "}
            · {errors.length} with errors (skipped)
          </span>
        )}
        {truncated > 0 && (
          <span className="text-red-light dark:text-red-dark">
            {" "}
            · {truncated} rows past the {MAX_UPLOAD_ROWS}-row limit ignored
          </span>
        )}
      </p>

      {errors.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-red-light/30 dark:border-red-dark/30 p-3 text-sm space-y-1">
          {errors.map((error) => (
            <li key={`${error.row}-${error.message}`}>
              <span className="font-semibold">Row {error.row}:</span>{" "}
              {error.message}
            </li>
          ))}
        </ul>
      )}

      {valid.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray">
          <table className="w-full text-left text-sm">
            <thead className="bg-lprimary/5 dark:bg-white/5 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2">Answer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray">
              {valid.slice(0, PREVIEW_ROWS).map((q) => (
                <tr key={q.row}>
                  <td className="px-3 py-2 tabular-nums">{q.row}</td>
                  <td className="px-3 py-2 break-words">{q.title}</td>
                  <td className="px-3 py-2 font-semibold text-[#20A97C] break-words">
                    {q.options.find((o) => o.isCorrect)?.title}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {valid.length > PREVIEW_ROWS && (
            <p className="px-3 py-2 text-xs text-off-dark dark:text-off-white">
              …and {valid.length - PREVIEW_ROWS} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
