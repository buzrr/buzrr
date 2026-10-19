"use client";

import { useState } from "react";
import clsx from "clsx";
import { RxCross2 } from "react-icons/rx";
import AddQuestionMenu from "@/components/Admin/Quiz/AddQuestionMenu";
import AllQues from "@/components/Admin/Quiz/AllQues";
import QuizInfoSection, {
  QuizInfoContent,
} from "@/components/Admin/Quiz/QuizInfoSection";
import HideQuestions from "@/components/Admin/Quiz/HideQuestions";
import HiddenQuestionsOverlay from "@/components/Admin/Quiz/HiddenQuestionsOverlay";
import HostQuizForm from "@/components/Admin/Quiz/HostQuizForm";
import LeaderboardView from "@/components/Admin/LeaderboardView";
import SoloReportView from "@/components/Solo/SoloReportView";
import Skeleton from "@/components/ui/Skeleton";
import { IconButton } from "@/components/ui/IconButton";
import { useQuizDetailQuery } from "@/lib/modules/quizzes/hooks";
import { isAxiosError } from "axios";
import { useT } from "@/lib/i18n/context";
import { notFound } from "next/navigation";

export default function QuizDetailClient({ quizId }: { quizId: string }) {
  const t = useT();
  const { data: quiz, isPending, isError, error } = useQuizDetailQuery(quizId);
  const [leaderboardId, setLeaderboardId] = useState<string | null>(null);
  const [soloReportId, setSoloReportId] = useState<string | null>(null);
  const showLeaderboard = (id: string) => {
    setSoloReportId(null);
    setLeaderboardId(id);
  };
  const showSoloReport = (id: string) => {
    setLeaderboardId(null);
    setSoloReportId(id);
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isError) {
    if (isAxiosError(error) && error.response?.status === 404) {
      notFound();
    }
    return (
      <div className="text-dark dark:text-white w-full h-full flex items-center justify-center p-8">
        {t("Could not load this quiz. Try again later.")}
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
        {t("Could not load this quiz. Try again later.")}
      </div>
    );
  }

  const questionCount = quiz._count?.questions ?? 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 md:py-4">
      <div className="text-dark dark:text-white w-full flex flex-col md:flex-row gap-3 md:h-[calc(100dvh-8.5rem)]">
        <QuizInfoSection
          quiz={quiz}
          onShowLeaderboard={showLeaderboard}
          onShowSoloReport={showSoloReport}
        />

        {/* Mobile drawer: the quiz info the top bar has no room for
            (description, public toggle, past sessions). */}
        <div
          aria-hidden="true"
          className={clsx(
            "fixed inset-0 z-10 bg-[#0000006a] md:hidden",
            !sidebarOpen && "hidden",
          )}
          onClick={() => setSidebarOpen(false)}
        ></div>
        <div
          className={clsx(
            "z-20 p-4 bg-white dark:bg-dark flex-col h-dvh fixed w-[80vw] left-0 top-0 md:hidden overflow-y-auto",
            sidebarOpen ? "flex" : "hidden",
          )}
        >
          <div className="flex justify-end">
            <IconButton
              aria-label={t("Close quiz info")}
              className="text-dark dark:text-white"
              onClick={() => setSidebarOpen(false)}
              icon={<RxCross2 size={22} />}
            />
          </div>
          <QuizInfoContent
            quiz={quiz}
            showHostForm={false}
            onShowLeaderboard={(resultId) => {
              showLeaderboard(resultId);
              setSidebarOpen(false);
            }}
            onShowSoloReport={(testId) => {
              showSoloReport(testId);
              setSidebarOpen(false);
            }}
          />
        </div>

        <div className="bg-white dark:bg-dark rounded-xl w-full flex-1 flex flex-col min-h-0">
          {soloReportId ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <SoloReportView
                testId={soloReportId}
                onBack={() => setSoloReportId(null)}
                backLabel={t("Back to quiz details")}
              />
            </div>
          ) : leaderboardId ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <LeaderboardView
                roomId={leaderboardId}
                onBack={() => setLeaderboardId(null)}
                backLabel={t("Back to quiz details")}
                onDeleted={() => setLeaderboardId(null)}
              />
            </div>
          ) : (
            <>
              <div className="p-3 flex items-center gap-2 justify-start md:hidden">
                <IconButton
                  aria-label={t("Open quiz info")}
                  className="text-dark dark:text-white"
                  onClick={() => setSidebarOpen(true)}
                  icon={
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16m-7 6h7"
                      />
                    </svg>
                  }
                />
                <p className="text-dark dark:text-white font-black">
                  {quiz.title}
                </p>
                <span className="ml-auto text-xs font-semibold rounded-lg px-2 py-1 bg-[#c4ee4f] text-[#2c3a08] dark:bg-[#b8e94a] dark:text-[#15200a]">
                  {`Questions: ${questionCount}`}
                </span>
              </div>
              {/* "Host quiz" floats at the bottom right, on every screen size. */}
              <HostQuizForm
                quizId={quizId}
                disabled={questionCount === 0}
                className="fixed bottom-14 right-4 z-30 w-56 md:w-64"
              />
              <div className="relative flex flex-col flex-1 min-h-0">
                <div className="relative flex flex-col flex-1 min-h-0 md:overflow-y-auto p-4 md:px-6 gap-4 md:gap-[18px]">
                  <div className="sticky -top-4 z-10 -mx-4 -mt-4 px-4 pt-4 pb-1 md:-mx-6 md:px-6 md:rounded-t-xl bg-white dark:bg-dark flex items-center gap-2 md:gap-3.5">
                    <AddQuestionMenu quizId={quizId} />
                    <HideQuestions defaultHidden={questionCount > 0} />
                  </div>
                  <AllQues quizId={quizId} />
                </div>
                <HiddenQuestionsOverlay quizId={quizId} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
