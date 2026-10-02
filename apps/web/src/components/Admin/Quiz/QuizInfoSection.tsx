"use client";

import Link from "next/link";
import { LuChevronRight } from "react-icons/lu";
import { toast } from "react-toastify";
import HostQuizForm from "@/components/Admin/Quiz/HostQuizForm";
import Switch from "@/components/ui/Switch";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import type { QuizDetail } from "@/lib/modules/quizzes/api";

function formatSessionDate(createdAt: string | Date) {
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return d.toLocaleString("en-US", { timeZoneName: "short" });
}

/**
 * The quiz info panel body: breadcrumb, description, public toggle and past
 * sessions. Rendered in the fixed desktop panel and inside the mobile drawer
 * (which hides the host form — the mobile top bar already has one).
 */
export function QuizInfoContent(props: {
  quiz: QuizDetail;
  showHostForm?: boolean;
  onShowLeaderboard?: (resultId: string) => void;
}) {
  const pastGames = props.quiz.gameResults ?? [];
  const questionCount = props.quiz._count?.questions ?? 0;
  const updateQuiz = useUpdateQuizMutation();
  const showHostForm = props.showHostForm ?? true;

  return (
    <>
      <div className="flex flex-col w-[90%] mx-auto text-dark dark:text-white">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-[13.5px] font-medium text-off-dark dark:text-[#9a9aa2]"
        >
          <Link
            href={"/admin"}
            className="hover:underline hover:text-dark dark:hover:text-white"
          >
            Home
          </Link>
          <LuChevronRight size={14} />
          <span className="font-semibold text-dark dark:text-white">
            Quizzes
          </span>
        </nav>
        <h2 className="text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.05] mt-3 mb-1 wrap-break-word">
          {props.quiz.title}
        </h2>
        <p className="capitalize mb-4 text-[15px] text-off-dark dark:text-[#9a9aa2]">
          {props.quiz.description}
        </p>
        <p className="w-fit my-1 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-[7px] text-[13px] font-semibold bg-[#c4ee4f] text-[#2c3a08] dark:bg-[#b8e94a] dark:text-[#15200a]">
          Total number of questions :{" "}
          <b className="font-extrabold">{questionCount}</b>
        </p>
        <div className="flex items-center gap-2 mt-3 mb-1">
          <Switch
            aria-label="Make quiz public for duels"
            checked={Boolean(props.quiz.isPublic)}
            disabled={updateQuiz.isPending}
            onCheckedChange={(checked) =>
              updateQuiz.mutate(
                { quizId: props.quiz.id, isPublic: checked },
                {
                  onError: (err) => toast.error(getApiErrorMessage(err)),
                },
              )
            }
          />
          <span className="text-sm max-w-[250px]">
            Public — questions are submitted for admin review before appearing
            in 1v1 duels
          </span>
        </div>
        {showHostForm && (
          <div className="w-full mt-[18px]">
            <HostQuizForm
              quizId={props.quiz.id}
              disabled={questionCount === 0}
              className="w-full"
            />
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col min-h-0 w-[90%] mx-auto text-dark dark:text-white">
        <div className="flex items-center justify-between mt-6 mb-3">
          <h4 className="text-sm font-bold tracking-[0.04em] uppercase text-[#8a8896] dark:text-[#9a9aa2]">
            Previously used
          </h4>
          <span className="rounded-full px-2.5 py-0.5 text-xs bg-lprimary/10 dark:bg-white/5 text-off-dark dark:text-[#9a9aa2]">
            {pastGames.length}
          </span>
        </div>
        <div className="overflow-auto flex-1 min-h-0 flex flex-col gap-2.5 pr-1 -mr-1">
          {pastGames.length > 0 ? (
            pastGames.map((result) => {
              const leaderboardClass =
                "flex-1 text-center rounded-[9px] p-[9px] text-[12.5px] font-semibold bg-[#ef7f4d] text-white transition-[filter] hover:brightness-106 cursor-pointer";
              return (
                <div
                  key={result.id}
                  className="rounded-[14px] p-3.5 border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 transition-[border-color,transform] hover:border-lprimary dark:hover:border-dprimary hover:-translate-y-px"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-[12.5px] font-medium text-off-dark dark:text-[#9a9aa2]">
                      {formatSessionDate(result.endedAt)}
                    </span>
                    <span className="text-[13px] font-extrabold tracking-[0.06em] rounded-[7px] px-2 py-0.5 text-lprimary dark:text-dprimary bg-lprimary/10 dark:bg-white/5">
                      {result.gameCode}
                    </span>
                  </div>
                  <div className="text-xs mt-2 mb-[11px] text-off-dark dark:text-[#9a9aa2]">
                    {result.playerCount} player
                    {result.playerCount === 1 ? "" : "s"} ·{" "}
                    {result.questionCount} question
                    {result.questionCount === 1 ? "" : "s"}
                  </div>
                  <div className="flex gap-2">
                    {props.onShowLeaderboard ? (
                      <button
                        type="button"
                        className={leaderboardClass}
                        onClick={() => props.onShowLeaderboard?.(result.id)}
                      >
                        See leaderboard
                      </button>
                    ) : (
                      <Link
                        href={`/admin/quiz/leaderboard/${result.id}`}
                        className={leaderboardClass}
                      >
                        See leaderboard
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-fit border border-lprimary/25 dark:border-white/15 border-dashed rounded-[14px] p-4 text-dark dark:text-white">
              <div className="p-2 text-lg font-black text-center">
                No Previously Used Quizzes
              </div>
              <p className="p-2 text-sm text-center">
                It looks like there are no previously used quizzes for this
                session. Start adding questions to create an engaging quiz for
                your students.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function QuizInfoSection(props: {
  quiz: QuizDetail;
  onShowLeaderboard?: (resultId: string) => void;
}) {
  return (
    <div className="md:w-2/5 lg:w-1/3 shrink-0 h-full bg-white dark:bg-dark rounded-xl p-4 hidden md:flex flex-col min-h-0">
      <QuizInfoContent
        quiz={props.quiz}
        onShowLeaderboard={props.onShowLeaderboard}
      />
    </div>
  );
}
