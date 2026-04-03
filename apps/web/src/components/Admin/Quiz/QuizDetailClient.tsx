"use client";

import BasicModal from "@/components/Modal";
import AddQuesForm from "@/components/Admin/Quiz/AddQuesForm";
import AllQues from "@/components/Admin/Quiz/AllQues";
import QuizInfoSection from "@/components/Admin/Quiz/QuizInfoSection";
import HideQuestions from "@/components/Admin/Quiz/HideQuestions";
import HostQuizForm from "@/components/Admin/Quiz/HostQuizForm";
import { useQuizDetailQuery } from "@/lib/modules/quizzes/hooks";
import { isAxiosError } from "axios";
import { notFound } from "next/navigation";

export default function QuizDetailClient({ quizId }: { quizId: string }) {
  const { data: quiz, isPending, isError, error } = useQuizDetailQuery(quizId);

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
      <div className="text-dark dark:text-white w-full h-full flex items-center justify-center p-8">
        Loading quiz…
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
    <div className="text-dark dark:text-white w-full h-full flex gap-2">
      <QuizInfoSection quiz={quiz} />
      <div className="bg-white dark:bg-dark w-full h-[83vh]">
        <div className="p-3 flex justify-start md:hidden">
          <p className="text-dark dark:text-white font-black">{quiz.title}</p>
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
        <div className="flex flex-col overflow-y-auto md:h-[calc(100vh-120px)] p-4 gap-4">
          <div className="flex justify-center items-center gap-2">
            <BasicModal btnTitle="+ Add Question">
              <AddQuesForm quizId={quizId} />
            </BasicModal>
            <HideQuestions />
          </div>
          <AllQues quizId={quizId} />
        </div>
      </div>
    </div>
  );
}
