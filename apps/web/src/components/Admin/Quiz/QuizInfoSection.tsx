import { prisma } from "@/utils/prisma";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";
import createRoom from "@/actions/CreateRoomAction";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";

async function QuizInfoSection(props: { quizId: string }) {
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");
  const quiz = await prisma.quiz.findUnique({
    where: {
      id: props.quizId as string,
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

  const allQuiz = quiz?.gameSessions ? quiz?.gameSessions : [];

  return (
    <>
      <form
        className="w-[40vw] h-[83vh] bg-white dark:bg-dark mr-2 hidden md:block"
        action={createRoom}
      >
        <div className="flex flex-col w-[90%] mx-auto text-dark dark:text-white">
          <div className="text-sm">
            <span className="p-1 py-2 underline underline-offset-1">
              <Link href={"/admin"}>Home</Link>
            </span>
            <span className="p-1 py-2">&gt;</span>
            <span className="p-1 py-2">Quizzes</span>
          </div>
          <h2 className="text-3xl my-3 font-bold">{quiz?.title}</h2>
          <p className="capitalize mb-4">{quiz?.description}</p>
          <p className="text-xs p-1 border border-[#8FB72E] bg-[#C4F849] rounded w-fit my-1 dark:text-dark">
            Total number of questions :{" "}
            <span className="font-semibold text-gray-50">
              {quiz?.questions?.length}
            </span>
          </p>
          <input type="hidden" name="quizId" value={props.quizId} />
          <div className="w-full mt-4">
            <SubmitButton
              text="Host quiz"
              isQuiz={true}
              error={quiz?.questions.length === 0}
            />
          </div>
        </div>
        <div className="my-2">
          <div className="font-black p-4">Previously used</div>
          <div className="my-2 h-[33.6vh] overflow-auto">
            {allQuiz?.length > 0 ? (
              allQuiz.map((quiz) => {
                return (
                  <div key={quiz.id}>
                    <div className="bg-card-light dark:bg-card-dark p-4 mt-2">
                      <div className="text-xs w-full flex justify-between">
                        <div>
                          {quiz.createdAt
                            .toLocaleString("en-US", { timeZoneName: "short" })
                            .toString()}
                        </div>
                        <div className="text-lprimary dark:text-dprimary font-black">
                          {quiz.gameCode}
                        </div>
                      </div>
                      <div className="text-xs mt-3 [&>*]:bg-[#f87d49] [&>*]:text-white [&>*]:dark:text-dark [&>*]:font-black [&>*]:rounded-md [&>*]:p-[6px] [&>*]:ml-1">
                        <Link href="#">Import Questions</Link>
                        <Link href={`/admin/quiz/leaderboard/${quiz.id}`}>
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
      </form>
    </>
  );
}

export default QuizInfoSection;
