import BasicModal from "@/components/Modal";
import AddQuesForm from "@/components/Admin/Quiz/AddQuesForm";
import AllQues from "@/components/Admin/Quiz/AllQues";
import QuizInfoSection from "@/components/Admin/Quiz/QuizInfoSection";
import { prisma } from "@buzrr/prisma";
import { auth } from "@/utils/auth";
import { redirect, notFound } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";
import createRoom from "@/actions/CreateRoomAction";
import HideQuestions from "@/components/Admin/Quiz/HideQuestions";

async function Quiz({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");
  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
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

  if (!quiz) {
    notFound();
  }

  return (
    <div className="w-full bg-light-bg dark:bg-dark-bg h-full">
      <div className="text-dark dark:text-white w-full h-full flex">
        <QuizInfoSection quiz={quiz} />
        <div className="bg-white dark:bg-dark w-full p-2 md:h-[83vh]">
          <div className="p-3 flex justify-start md:hidden">
            <span className="text-dark dark:text-white font-black">
              {quiz?.title}
            </span>
            <span className="ml-auto text-xs bg-[#c4f849] border border-[#9dc048] p-1 text-dark rounded-lg">
              {`Total number of questions: ${quiz?.questions.length}`}
            </span>
          </div>
          <div className="w-[95%] mx-auto my-2 md:hidden">
            <form action={createRoom}>
              <input type="hidden" name="quizId" value={quizId} />
              <SubmitButton
                text="Host quiz"
                isQuiz={true}
                error={quiz?.questions.length === 0}
              />
            </form>
          </div>
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
