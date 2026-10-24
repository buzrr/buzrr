"use client";

import { toast } from "react-toastify";
import { quizSettingsSchema, type QuizSettings } from "@buzrr/contract";
import Switch from "@/components/ui/Switch";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import type { QuizDetail } from "@/lib/modules/quizzes/api";

/**
 * The quiz's settings in the editor (live reactions), saved to
 * `Quiz.settings` on every change.
 */
export default function QuizSettingsCard({ quiz }: { quiz: QuizDetail }) {
  const updateQuiz = useUpdateQuizMutation();
  const parsed = quizSettingsSchema.safeParse(quiz.settings ?? {});
  const settings: QuizSettings = parsed.success
    ? parsed.data
    : quizSettingsSchema.parse({});

  return (
    <div className="mt-3 mb-1 flex items-center gap-2">
      <Switch
        aria-label="Live reactions"
        checked={settings.reactions}
        disabled={updateQuiz.isPending}
        onCheckedChange={(checked) =>
          updateQuiz.mutate(
            { quizId: quiz.id, settings: { ...settings, reactions: checked } },
            { onError: (err) => toast.error(getApiErrorMessage(err)) },
          )
        }
      />
      <span className="text-sm max-w-[250px]">
        Live reactions — players can send 👍 ❤️ 😂 to your screen
      </span>
    </div>
  );
}
