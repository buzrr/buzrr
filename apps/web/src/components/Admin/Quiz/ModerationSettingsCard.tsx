"use client";

import { toast } from "react-toastify";
import QuizSettingsFields, {
  quizSettingsOf,
} from "@/components/Admin/Quiz/QuizSettingsFields";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import type { QuizDetail } from "@/lib/modules/quizzes/api";

/**
 * The quiz's settings in the editor (sounds, reactions, moderated mode),
 * saved to `Quiz.settings` on every change. They are also what the
 * "Host quiz" dialog starts from.
 */
export default function ModerationSettingsCard({ quiz }: { quiz: QuizDetail }) {
  const updateQuiz = useUpdateQuizMutation();
  return (
    <div className="mt-3 mb-1">
      <QuizSettingsFields
        settings={quizSettingsOf(quiz.settings)}
        disabled={updateQuiz.isPending}
        onChange={(settings) =>
          updateQuiz.mutate(
            { quizId: quiz.id, settings },
            { onError: (err) => toast.error(getApiErrorMessage(err)) },
          )
        }
      />
    </div>
  );
}
