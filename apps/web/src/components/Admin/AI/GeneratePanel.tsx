"use client";

import clsx from "clsx";
import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { GenerationRun } from "@/lib/modules/ai/api";
import { useGenerateMutation } from "@/lib/modules/ai/hooks";

const MIN_COUNT = 1;
const MAX_COUNT = 15;

const QUESTION_TYPES = [
  { value: "MCQ", label: "Multiple choice" },
  { value: "TRUE_FALSE", label: "True / False" },
] as const;

export default function GeneratePanel({
  spaceId,
  disabled,
  onGenerated,
}: {
  spaceId: string;
  disabled: boolean;
  onGenerated: (run: GenerationRun) => void;
}) {
  const [prompt, setPrompt] = useState("");
  // Held as a string so the field can be empty mid-edit — with a number the
  // input can never be cleared, which strands you on whatever digit is there.
  const [count, setCount] = useState("10");
  const [types, setTypes] = useState<string[]>(["MCQ"]);
  const mutation = useGenerateMutation(spaceId);

  function clampCount(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return MIN_COUNT;
    return Math.min(MAX_COUNT, Math.max(MIN_COUNT, parsed));
  }

  function toggleType(value: string) {
    setTypes((current) =>
      current.includes(value)
        ? current.filter((t) => t !== value) || []
        : [...current, value],
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    mutation.mutate(
      {
        prompt: prompt.trim(),
        count: clampCount(count),
        questionTypes: types.length > 0 ? types : ["MCQ"],
      },
      {
        onSuccess: (run) => {
          onGenerated(run);
          toast.success(
            `Generated ${run.questions.length} question${run.questions.length === 1 ? "" : "s"}`,
          );
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  }

  return (
    <form onSubmit={submit}>
      <label
        htmlFor="ai-prompt"
        className="block text-sm font-bold text-dark dark:text-white"
      >
        What should I generate?
      </label>
      <textarea
        id="ai-prompt"
        rows={3}
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Generate questions for the topic third law of motion"
        className="mt-1 w-full rounded-xl border border-gray bg-white dark:bg-dark text-dark dark:text-white px-4 py-3 outline-none focus:border-lprimary dark:focus:border-dprimary disabled:opacity-50"
      />

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <span className="block text-xs font-bold text-dark dark:text-white">
            Question types
          </span>
          <div className="mt-1 flex gap-1.5">
            {QUESTION_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                disabled={disabled}
                aria-pressed={types.includes(type.value)}
                onClick={() => toggleType(type.value)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50",
                  types.includes(type.value)
                    ? "bg-lprimary text-white dark:bg-dprimary dark:text-dark"
                    : "bg-card-light dark:bg-dark text-off-dark dark:text-off-white",
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="ai-count"
            className="block text-xs font-bold text-dark dark:text-white"
          >
            How many
          </label>
          <input
            id="ai-count"
            type="number"
            inputMode="numeric"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={count}
            disabled={disabled}
            // Accept anything (including "") while typing; settle it on blur so
            // the value that leaves the field is always within range.
            onChange={(event) => setCount(event.target.value)}
            onBlur={() => setCount(String(clampCount(count)))}
            className="mt-1 w-20 rounded-lg border border-gray bg-white dark:bg-dark text-dark dark:text-white px-3 py-1.5 outline-none focus:border-lprimary dark:focus:border-dprimary disabled:opacity-50"
          />
        </div>

        <Button
          type="submit"
          disabled={disabled || !prompt.trim()}
          isLoading={mutation.isPending}
          loadingText="Generating..."
        >
          Generate
        </Button>
      </div>
    </form>
  );
}
