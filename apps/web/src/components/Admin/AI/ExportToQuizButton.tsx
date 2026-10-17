"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { GeneratedQuestion } from "@/lib/modules/ai/api";
import { useImportAsQuizMutation } from "@/lib/modules/ai/hooks";
import { usePlanLimitPrompt } from "@/components/Billing/UpgradePrompt";

export default function ExportToQuizButton({
  title,
  questions,
}: {
  title: string;
  questions: GeneratedQuestion[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const mutation = useImportAsQuizMutation();
  const { handlePlanLimit, upgradePrompt } = usePlanLimitPrompt();

  const keepers = questions.filter((question) => !question.discarded);

  function submit() {
    if (keepers.length === 0) return;
    mutation.mutate(
      {
        title,
        description: "Generated from a Buzrr AI knowledge space",
        questions: keepers.map((question) =>
          question.type === "TRUE_FALSE"
            ? {
                // True / false is stored as its answer, not as options.
                title: question.stem,
                type: "true_false" as const,
                config: {
                  answer:
                    question.options.find((o) => o.isCorrect)?.title === "True",
                },
              }
            : {
                title: question.stem,
                type: "multiple_choice" as const,
                options: question.options,
              },
        ),
      },
      {
        onSuccess: (result) => {
          setOpen(false);
          toast.success(`Saved ${result.questionCount} questions`);
          router.push(`/admin/quiz/${result.quizId}`);
        },
        onError: (error) => {
          if (handlePlanLimit(error)) {
            setOpen(false);
            return;
          }
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={keepers.length === 0}>
        Save as Buzrr quiz ({keepers.length})
      </Button>
      <ConfirmationModal
        open={open}
        setOpen={setOpen}
        desc={`Create a new quiz with these ${keepers.length} question${keepers.length === 1 ? "" : "s"}? You can edit it afterwards like any other quiz.`}
        confirmLabel="Save quiz"
        confirming={mutation.isPending}
        confirmingLabel="Saving…"
        onClick={submit}
      />
      {upgradePrompt}
    </>
  );
}
