"use client";

import clsx from "clsx";
import { LuPlus } from "react-icons/lu";
import ActionCard from "./ActionCard";
import CreateAIQuiz from "../Gemini/CreateAIQuiz";
import ImportQuizModal from "./ImportQuizModal";
import { useAppSelector } from "@/state/hooks";
import { useAiStatusQuery } from "@/lib/modules/quizzes/hooks";

export default function QuizActionCards() {
  const view = useAppSelector((state) => state.gridListToggle.view);
  // No AI model configured on the server: no AI card.
  const ai = useAiStatusQuery();

  return (
    <div
      className={clsx(
        "gap-3 md:gap-4",
        view === "grid" ? "grid grid-cols-2 md:grid-cols-3" : "flex flex-col",
      )}
    >
      <ActionCard
        view={view}
        href="/admin/quiz/createQuiz"
        icon={<LuPlus strokeWidth={2.4} />}
        title="Create a new quiz"
        subtitle="Build from the ground up"
      />
      <ImportQuizModal />
      {ai.data?.available && (
        <CreateAIQuiz
          className={view === "grid" ? "col-span-2 md:col-span-1" : undefined}
        />
      )}
    </div>
  );
}
