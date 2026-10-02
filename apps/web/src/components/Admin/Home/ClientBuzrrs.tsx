"use client";
import clsx from "clsx";
import { useState } from "react";
import { toast } from "react-toastify";
import QuizCard from "./QuizCard";
import EditQuizModal from "./EditQuizModal";
import ConfirmationModal from "../ConfirmationModal";
import { EmptyState } from "@/components/ui/Card";
import { useAppSelector } from "@/state/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { QuizListItem } from "@/lib/modules/quizzes/api";
import { useDeleteQuizMutation } from "@/lib/modules/quizzes/hooks";

export function quizGridClass(view: "grid" | "list") {
  return clsx(
    "gap-3 md:gap-4",
    view === "grid" ? "grid grid-cols-2 md:grid-cols-3" : "flex flex-col",
  );
}

export default function ClientBuzrrs({ quizzes }: { quizzes: QuizListItem[] }) {
  const deleteQuizMutation = useDeleteQuizMutation();
  const view = useAppSelector((state) => state.gridListToggle.view);

  const [delModalOpen, setDelModalOpen] = useState(false);
  const [quizId, setQuizId] = useState("");
  const [editQuiz, setEditQuiz] = useState<QuizListItem | null>(null);

  function deleteQuiz(id: string) {
    deleteQuizMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Successfully deleted quiz");
        setDelModalOpen(false);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
    });
  }

  if (quizzes.length === 0) {
    return (
      <EmptyState
        title="No quizzes yet"
        hint="Create one from scratch or let AI draft it for you."
      />
    );
  }

  return (
    <>
      <div className={quizGridClass(view)}>
        {quizzes.map((quiz) => (
          <QuizCard
            key={quiz.id}
            quiz={quiz}
            view={view}
            onEdit={() => setEditQuiz(quiz)}
            onDelete={() => {
              setQuizId(quiz.id);
              setDelModalOpen(true);
            }}
          />
        ))}
      </div>
      <ConfirmationModal
        open={delModalOpen}
        setOpen={setDelModalOpen}
        onClick={() => {
          deleteQuiz(quizId);
        }}
        desc="Are you sure you want to delete this quiz?"
      />
      <EditQuizModal
        quiz={editQuiz}
        open={editQuiz !== null}
        setOpen={(open) => {
          if (!open) setEditQuiz(null);
        }}
      />
    </>
  );
}
