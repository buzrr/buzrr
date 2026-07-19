"use client";

import { useState } from "react";
import BasicModal from "@/components/Modal";
import AddQuesForm from "@/components/Admin/Quiz/AddQuesForm";
import AllQues from "@/components/Admin/Quiz/AllQues";
import QuizInfoSection from "@/components/Admin/Quiz/QuizInfoSection";
import HideQuestions from "@/components/Admin/Quiz/HideQuestions";
import HostQuizForm from "@/components/Admin/Quiz/HostQuizForm";
import LeaderboardView from "@/components/Admin/LeaderboardView";
import Skeleton from "@/components/ui/Skeleton";
import { useQuizDetailQuery } from "@/lib/modules/quizzes/hooks";
import { isAxiosError } from "axios";
import { notFound } from "next/navigation";

export default function QuizDetailClient({ quizId }: { quizId: string }) {
  const { data: quiz, isPending, isError, error } = useQuizDetailQuery(quizId);
  const [leaderboardId, setLeaderboardId] = useState<string | null>(null);

  if (isError) {
    if (isAxiosError(error) && error.response?.status === 404) {
      notFound();
    }
    return (
      <div className="text-dark dark:text-white w-full h-full flex items-center justify-center p-8">
        Could not load this quiz. Try again later.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 md:py-4">
        <div className="w-full flex gap-3">
          <Skeleton className="hidden md:block md:w-2/5 lg:w-1/3 h-[80vh] rounded-xl bg-white dark:bg-card-dark" />
          <Skeleton className="w-full h-[80vh] rounded-xl bg-white dark:bg-card-dark" />
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-dark dark:text-white w-full h-full flex items-center justify-center p-8">
        Could not load this quiz. Try again later.
      </div>
    );
  }

  const questionCount = quiz._count?.questions ?? 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 md:py-4">
      <div className="text-dark dark:text-white w-full flex flex-col md:flex-row gap-3 md:h-[calc(100dvh-12rem)]">
        <QuizInfoSection quiz={quiz} onShowLeaderboard={setLeaderboardId} />
        <div className="bg-white dark:bg-dark rounded-xl w-full flex-1 flex flex-col min-h-0">
          {leaderboardId ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <LeaderboardView
                roomId={leaderboardId}
                onBack={() => setLeaderboardId(null)}
                backLabel="Back to quiz details"
              />
            </div>
          ) : (
            <>
              <div className="p-3 flex items-center justify-start md:hidden">
                <p className="text-dark dark:text-white font-black">
                  {quiz.title}
                </p>
                <span className="ml-auto text-xs bg-[#c4f849] border border-[#9dc048] p-1 text-dark rounded-lg">
                  {`Total number of questions: ${questionCount}`}
                </span>
              </div>
              <div className="w-[95%] mx-auto my-2 md:hidden">
                <HostQuizForm
                  quizId={quizId}
                  disabled={questionCount === 0}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col flex-1 min-h-0 md:overflow-y-auto p-4 gap-4">
                <div className="flex justify-center items-center gap-2">
                  <BasicModal btnTitle="+ Add Question">
                    <AddQuesForm quizId={quizId} />
                  </BasicModal>
                  <HideQuestions />
                </div>
                <AllQues quizId={quizId} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
