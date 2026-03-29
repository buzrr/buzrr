import BasicModal from "@/components/Modal";
import AddQuesForm from "@/components/Admin/Quiz/AddQuesForm";
import AllQues from "@/components/Admin/Quiz/AllQues";
import QuizInfoSection from "@/components/Admin/Quiz/QuizInfoSection";
import { prisma } from "@buzrr/prisma";
import { auth } from "@/utils/auth";
import { redirect, notFound } from "next/navigation";
import HideQuestions from "@/components/Admin/Quiz/HideQuestions";
import HostQuizForm from "@/components/Admin/Quiz/HostQuizForm";

async function Quiz({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();

  if (!session || !session.user || !session.user.id) redirect("/api/auth/signin");
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      userId: session.user.id,
    },
    include: {
      questions: true,
      gameSessions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!quiz) notFound();

  return (
    <div className="text-dark dark:text-white w-full h-full flex gap-2">
      <QuizInfoSection quiz={quiz} />
      <div className="bg-white dark:bg-dark w-full h-[83vh]">
        <div className="p-3 flex justify-start md:hidden">
          <p className="text-dark dark:text-white font-black">
            {quiz?.title}
          </p>
          <span className="ml-auto text-xs bg-[#c4f849] border border-[#9dc048] p-1 text-dark rounded-lg">
            {`Total number of questions: ${quiz?.questions.length}`}
          </span>
        </div>
        <div className="w-[95%] mx-auto my-2 md:hidden">
          <HostQuizForm
            quizId={quizId}
            disabled={quiz?.questions.length === 0}
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

export default Quiz;
