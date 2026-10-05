"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import { Modal } from "@mui/material";
import { LuDownload, LuX, LuFileSpreadsheet, LuFileJson } from "react-icons/lu";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import ActionCard from "@/components/Admin/Home/ActionCard";
import { useAppSelector } from "@/state/hooks";
import { useImportQuizMutation } from "@/lib/modules/quizzes/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { primaryButtonClass, mutedText } from "@/components/Game/GameUI";
import { usePlanLimitPrompt } from "@/components/Billing/UpgradePrompt";

export default function ImportQuizModal({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"csv" | "excel">("excel");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const view = useAppSelector((state) => state.gridListToggle.view);
  const mutation = useImportQuizMutation();
  const { handlePlanLimit, upgradePrompt } = usePlanLimitPrompt();

  const close = () => {
    if (mutation.isPending || isParsing) return;
    setOpen(false);
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const processData = (data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      toast.error("File is empty or invalid format.");
      return;
    }

    const title =
      String(data[0]["Quiz Title"] ?? "Imported Quiz") || "Imported Quiz";
    const description = String(data[0]["Quiz Description"] ?? "");

    const questions = data
      .map((row) => {
        const options: { title: string; isCorrect: boolean }[] = [];
        for (let i = 1; i <= 4; i++) {
          const optionTitle = row[`Option ${i}`];
          if (optionTitle) {
            options.push({
              title: String(optionTitle),
              isCorrect:
                String(row[`Option ${i} is Correct`]).toUpperCase() === "TRUE",
            });
          }
        }

        if (options.length < 4) {
          // Fallback for valid questions to have 4 options to match AddQuesForm expectations
          while (options.length < 4) {
            options.push({ title: "Option", isCorrect: false });
          }
        }

        // Ensure exactly one option is correct to satisfy backend constraints
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount === 0) {
          options[0].isCorrect = true;
        } else if (correctCount > 1) {
          let foundFirst = false;
          options.forEach((o) => {
            if (o.isCorrect) {
              if (foundFirst) o.isCorrect = false;
              else foundFirst = true;
            }
          });
        }

        return {
          title: String(row["Question Title"] || "Untitled Question"),
          timeOut: Number(row["Time Limit (sec)"]) || 20,
          options,
        };
      })
      .filter((q) => q.title && q.title.trim() !== "Untitled Question");

    if (questions.length === 0) {
      toast.error("Could not find any valid questions in the file.");
      return;
    }

    mutation.mutate(
      { title, description, questions },
      {
        onSuccess: (res) => {
          toast.success("Quiz imported successfully!");
          close();
          router.push(`/admin/quiz/${res.quizId}`);
        },
        onError: (err) => {
          if (handlePlanLimit(err)) {
            close();
            return;
          }
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file to import.");
      return;
    }

    setIsParsing(true);

    try {
      if (tab === "csv" || file.name.endsWith(".csv")) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processData(results.data as Record<string, unknown>[]);
            setIsParsing(false);
          },
          error: (error) => {
            toast.error(`Error parsing CSV: ${error.message}`);
            setIsParsing(false);
          },
        });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json =
              XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            processData(json);
          } catch {
            toast.error(
              "Failed to parse Excel file. Make sure it uses the correct template.",
            );
          } finally {
            setIsParsing(false);
          }
        };
        reader.onerror = () => {
          toast.error("Error reading file.");
          setIsParsing(false);
        };
        reader.readAsArrayBuffer(file);
      }
    } catch {
      toast.error("An unexpected error occurred during parsing.");
      setIsParsing(false);
    }
  };

  const isLoading = mutation.isPending || isParsing;

  return (
    <>
      <ActionCard
        view={view}
        onClick={() => setOpen(true)}
        icon={<LuDownload />}
        title="Import an existing quiz"
        subtitle="Upload via Excel or CSV"
        className={className}
      />

      <Modal
        open={open}
        onClose={close}
        aria-labelledby="import-quiz-title"
        slotProps={{
          backdrop: {
            className: "!bg-[rgba(10,8,20,0.55)] backdrop-blur-[3px]",
          },
        }}
      >
        <div
          className="fixed inset-0 flex items-end md:items-center justify-center md:p-6 outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full md:max-w-[500px] max-h-[92dvh] overflow-y-auto flex flex-col rounded-t-[26px] md:rounded-[26px] border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] text-dark dark:text-white"
          >
            <div className="flex items-start gap-4 px-5 pt-[22px] md:px-7 md:pt-[26px]">
              <span className="size-12 shrink-0 rounded-[14px] bg-linear-to-br from-[#10b981] to-[#059669] text-white flex items-center justify-center shadow-[0_10px_24px_-10px_#059669]">
                <LuDownload size={24} />
              </span>
              <div className="min-w-0 mt-1">
                <h2
                  id="import-quiz-title"
                  className="text-xl md:text-[22px] font-bold tracking-[-0.01em] leading-tight"
                >
                  Import a Quiz
                </h2>
                <p
                  className={clsx(
                    "mt-1 text-[14.5px] leading-normal",
                    mutedText,
                  )}
                >
                  Upload your questions using our template.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                disabled={isLoading}
                className={clsx(
                  "ml-auto size-9 shrink-0 rounded-[10px] flex items-center justify-center hover:bg-lprimary/8 dark:hover:bg-white/5 hover:text-dark dark:hover:text-white transition-colors cursor-pointer",
                  mutedText,
                  isLoading && "opacity-50 cursor-not-allowed",
                )}
              >
                <LuX size={18} />
              </button>
            </div>

            <div className="px-5 pt-[22px] md:px-7 md:pt-6">
              <div className="flex bg-lprimary/5 dark:bg-white/5 rounded-xl p-1 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setTab("excel");
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className={clsx(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2",
                    tab === "excel"
                      ? "bg-white dark:bg-[#2a2a2a] shadow-sm text-lprimary dark:text-dprimary"
                      : "text-dark/60 dark:text-white/60 hover:text-dark dark:hover:text-white",
                  )}
                >
                  <LuFileSpreadsheet size={16} /> Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("csv");
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className={clsx(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2",
                    tab === "csv"
                      ? "bg-white dark:bg-[#2a2a2a] shadow-sm text-lprimary dark:text-dprimary"
                      : "text-dark/60 dark:text-white/60 hover:text-dark dark:hover:text-white",
                  )}
                >
                  <LuFileJson size={16} /> CSV
                </button>
              </div>

              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-lprimary/20 dark:border-white/10 rounded-2xl bg-lprimary/5 dark:bg-white/[0.02]">
                <p className="text-sm font-medium mb-3 text-center">
                  1. Download the template
                </p>
                <a
                  href={`/sample-quiz.${tab === "excel" ? "xlsx" : "csv"}`}
                  download
                  className="px-4 py-2 bg-white dark:bg-white/10 border border-lprimary/20 dark:border-white/20 rounded-xl text-sm font-semibold shadow-sm hover:bg-lprimary/5 dark:hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <LuDownload size={16} />
                  Download {tab === "excel" ? "Excel" : "CSV"} Template
                </a>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <label className="text-sm font-medium text-dark/80 dark:text-white/80">
                  2. Upload filled document
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={tab === "excel" ? ".xlsx, .xls" : ".csv"}
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="block w-full text-sm text-dark/70 dark:text-white/70
                    file:mr-4 file:py-2.5 file:px-4
                    file:rounded-xl file:border-0
                    file:text-sm file:font-semibold
                    file:bg-lprimary/10 file:text-lprimary
                    dark:file:bg-dprimary/20 dark:file:text-dprimary
                    hover:file:bg-lprimary/20 dark:hover:file:bg-dprimary/30
                    transition-all file:cursor-pointer cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-lprimary/15 dark:border-white/10 px-5 py-5 md:px-7 md:py-5">
              <button
                type="button"
                onClick={close}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || isLoading}
                className={clsx(primaryButtonClass, "px-6 py-2.5 !w-auto")}
              >
                {isLoading ? "Importing..." : "Import Quiz"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
      {upgradePrompt}
    </>
  );
}
