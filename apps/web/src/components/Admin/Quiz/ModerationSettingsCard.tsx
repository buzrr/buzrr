"use client";

import { toast } from "react-toastify";
import {
  quizSettingsSchema,
  type ModerationSettings,
  type QuizSettings,
} from "@buzrr/contract";
import Switch from "@/components/ui/Switch";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import type { QuizDetail } from "@/lib/modules/quizzes/api";

type SubKey = Exclude<keyof ModerationSettings, "enabled">;

const SUB_OPTIONS: { key: SubKey; label: string; parent?: SubKey }[] = [
  { key: "confirmNextQuestion", label: "Get-ready slide before each question (host starts it)" },
  { key: "showAnswer", label: "Show answer" },
  { key: "confirmShowAnswer", label: "Confirm show answer", parent: "showAnswer" },
  { key: "showScores", label: "Show scores after every question" },
  { key: "confirmShowScores", label: "Confirm show scores", parent: "showScores" },
];

/**
 * Moderated mode: the host steps the room through every question — get-ready
 * slide, countdown, question, answer, scores. Stored in `Quiz.settings`.
 */
export default function ModerationSettingsCard({ quiz }: { quiz: QuizDetail }) {
  const updateQuiz = useUpdateQuizMutation();
  const parsed = quizSettingsSchema.safeParse(quiz.settings ?? {});
  const settings: QuizSettings = parsed.success
    ? parsed.data
    : quizSettingsSchema.parse({});
  const mod = settings.moderation;

  const save = (patch: Partial<ModerationSettings>) =>
    updateQuiz.mutate(
      {
        quizId: quiz.id,
        settings: { ...settings, moderation: { ...mod, ...patch } },
      },
      { onError: (err) => toast.error(getApiErrorMessage(err)) },
    );

  return (
    <div className="mt-3 mb-1 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Switch
          aria-label="Moderated mode"
          checked={mod.enabled}
          disabled={updateQuiz.isPending}
          onCheckedChange={(checked) => save({ enabled: checked })}
        />
        <span className="text-sm max-w-[250px]">
          Moderated mode — you step the room through every question
        </span>
      </div>
      {mod.enabled && (
        <div className="ml-3 pl-3 border-l-2 border-lprimary/20 dark:border-white/10 flex flex-col gap-2">
          {SUB_OPTIONS.map((o) => {
            const disabled =
              updateQuiz.isPending || (o.parent ? !mod[o.parent] : false);
            return (
              <label
                key={o.key}
                className={`flex items-center gap-2 ${o.parent ? "ml-4" : ""} ${disabled && o.parent ? "opacity-50" : ""}`}
              >
                <Switch
                  aria-label={o.label}
                  checked={mod[o.key]}
                  disabled={disabled}
                  onCheckedChange={(checked) => save({ [o.key]: checked })}
                />
                <span className="text-[13px] max-w-[230px]">{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
