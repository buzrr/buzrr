"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import QuizCard from "./QuizCard";
import EditQuizModal from "./EditQuizModal";
import ConfirmationModal from "../ConfirmationModal";
import { EmptyState } from "@/components/ui/Card";
import { useAppSelector } from "@/state/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { QuizListItem } from "@/lib/modules/quizzes/api";
import { useDeleteQuizMutation } from "@/lib/modules/quizzes/hooks";
import {
  useMediaQuery,
  useWindowListVirtualizer,
} from "@/hooks/useWindowListVirtualizer";

export function quizGridClass(view: "grid" | "list") {
  return clsx(
    "gap-3 md:gap-4",
    view === "grid" ? "grid grid-cols-2 md:grid-cols-3" : "flex flex-col",
  );
}

/**
 * The quiz cards, virtualized one visual row at a time (a row is 2 or 3
 * cards in the grid, 1 in the list) so long lists stay light. Column count
 * and gap follow `quizGridClass`'s breakpoints. Remount it (key) when the
 * view or breakpoint changes: cached row sizes belong to the old layout.
 */
function VirtualQuizRows({
  quizzes,
  view,
  isMd,
  onEdit,
  onDelete,
}: {
  quizzes: QuizListItem[];
  view: "grid" | "list";
  isMd: boolean;
  onEdit: (quiz: QuizListItem) => void;
  onDelete: (quiz: QuizListItem) => void;
}) {
  const columns = view === "grid" ? (isMd ? 3 : 2) : 1;
  const rows = useMemo(() => {
    const out: QuizListItem[][] = [];
    for (let i = 0; i < quizzes.length; i += columns) {
      out.push(quizzes.slice(i, i + columns));
    }
    return out;
  }, [quizzes, columns]);

  const { listRef, virtualizer, scrollMargin } = useWindowListVirtualizer({
    count: rows.length,
    estimateSize: view === "grid" ? 190 : 80,
    gap: isMd ? 16 : 12,
  });

  return (
    <div
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const cards = rows[row.index]!;
        return (
          <div
            key={row.index}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className={clsx("absolute left-0 w-full", quizGridClass(view))}
            style={{ top: row.start - scrollMargin }}
          >
            {cards.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                view={view}
                onEdit={() => onEdit(quiz)}
                onDelete={() => onDelete(quiz)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function ClientBuzrrs({ quizzes }: { quizzes: QuizListItem[] }) {
  const deleteQuizMutation = useDeleteQuizMutation();
  const view = useAppSelector((state) => state.gridListToggle.view);
  const isMd = useMediaQuery("(min-width: 768px)");

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
      <VirtualQuizRows
        key={`${view}-${isMd ? "md" : "sm"}`}
        quizzes={quizzes}
        view={view}
        isMd={isMd}
        onEdit={setEditQuiz}
        onDelete={(quiz) => {
          setQuizId(quiz.id);
          setDelModalOpen(true);
        }}
      />
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
