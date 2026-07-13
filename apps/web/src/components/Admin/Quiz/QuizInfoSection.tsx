"use client";

import Link from "next/link";
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

export default function QuizInfoSection(props: { quiz: QuizDetail }) {
  const pastGames = props.quiz.gameResults ?? [];
  const questionCount = props.quiz._count?.questions ?? 0;
  const updateQuiz = useUpdateQuizMutation();

  return (
    <>
      <div className="w-[40vw] h-[83vh] bg-white dark:bg-dark p-4 hidden md:flex flex-col">
        <div className="flex flex-col w-[90%] mx-auto text-dark dark:text-white">
          <div className="text-sm">
            <span className="p-1 py-2 underline underline-offset-1">
              <Link href={"/admin"}>Home</Link>
            </span>
            <span className="p-1 py-2">&gt;</span>
            <span className="p-1 py-2">Quizzes</span>
          </div>
          <h2 className="text-3xl my-3 font-bold">{props.quiz.title}</h2>
          <p className="capitalize mb-4">{props.quiz.description}</p>
          <p className="text-xs p-1 border border-[#8FB72E] bg-[#C4F849] rounded w-fit my-1 dark:text-dark">
            Total number of questions : {questionCount}
          </p>
          <div className="flex items-center gap-2 my-2">
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
            <span className="text-sm">
              Public — questions may appear in 1v1 duels
            </span>
          </div>
          <div className="w-full mt-4">
            <HostQuizForm
              quizId={props.quiz.id}
              disabled={questionCount === 0}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="font-black p-4">Previously used</div>
          <div className="overflow-auto flex-1 min-h-0 mx-[-8px]">
            {pastGames.length > 0 ? (
              pastGames.map((result) => {
                return (
                  <div key={result.id}>
                    <div className="bg-card-light dark:bg-card-dark p-4 mt-2">
                      <div className="text-xs w-full flex justify-between">
                        <div>{formatSessionDate(result.endedAt)}</div>
                        <div className="text-lprimary dark:text-dprimary font-black">
                          {result.gameCode}
                        </div>
                      </div>
                      <div className="text-xs mt-2">
                        {result.playerCount} player
                        {result.playerCount === 1 ? "" : "s"} ·{" "}
                        {result.questionCount} question
                        {result.questionCount === 1 ? "" : "s"}
                      </div>
                      <div className="text-xs mt-3 *:bg-[#f87d49] *:text-white *:dark:text-dark *:font-black *:rounded-md *:p-[6px] *:ml-1">
                        <Link href={`/admin/quiz/leaderboard/${result.id}`}>
                          See leaderboard
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-fit w-[95%] mx-auto border border-gray border-dashed rounded-lg p-4 text-dark dark:text-white">
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
      </div>
    </>
  );
}
