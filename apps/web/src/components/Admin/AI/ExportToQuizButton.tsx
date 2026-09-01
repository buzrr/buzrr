"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { GeneratedQuestion } from "@/lib/modules/ai/api";
import { useImportAsQuizMutation } from "@/lib/modules/ai/hooks";

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

  const keepers = questions.filter((question) => !question.discarded);

  function submit() {
    if (keepers.length === 0) return;
    mutation.mutate(
      {
        title,
        description: "Generated from a Buzrr AI knowledge space",
        questions: keepers.map((question) => ({
          title: question.stem,
          options: question.options,
        })),
      },
      {
        onSuccess: (result) => {
          setOpen(false);
          toast.success(`Saved ${result.questionCount} questions`);
          router.push(`/admin/quiz/${result.quizId}`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
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
    </>
  );
}
