import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";
import createRoom from "@/actions/CreateRoomAction";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";

async function QuizInfoSection(props: { quiz: any }) {
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");

  const allQuiz = props.quiz.gameSessions ? props.quiz.gameSessions : [];

  return (
    <>
      <form
        className="w-[40vw] h-[83vh] bg-white dark:bg-dark p-4 hidden md:flex flex-col"
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
          <h2 className="text-3xl my-3 font-bold">{props.quiz.title}</h2>
          <p className="capitalize mb-4">{props.quiz.description}</p>
          <p className="text-xs p-1 border border-[#8FB72E] bg-[#C4F849] rounded w-fit my-1 dark:text-dark">
            Total number of questions : {props.quiz.questions?.length ?? 0}
          </p>
          <input type="hidden" name="quizId" value={props.quiz.id} readOnly/>
          <div className="w-full mt-4">
            <SubmitButton
              text="Host quiz"
              isQuiz={true}
              error={!props.quiz.questions?.length}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="font-black p-4">Previously used</div>
          <div className="overflow-auto flex-1 min-h-0 mx-[-8px]">
            {allQuiz?.length > 0 ? (
              allQuiz.map((quiz: any) => {
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
                      <div className="text-xs mt-3 *:bg-[#f87d49] *:text-white *:dark:text-dark *:font-black *:rounded-md *:p-[6px] *:ml-1">
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
