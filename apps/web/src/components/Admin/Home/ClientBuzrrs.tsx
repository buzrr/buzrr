"use client";
import type { Quiz } from "@buzrr/prisma";
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import CreateAIQuiz from "../Gemini/CreateAIQuiz";
import ClientImage from "@/components/ClientImage";
import { useSelector } from "react-redux";
import { RootState } from "@/state/store";
import useContextMenu from "@/hooks/useContextMenu";
import ConfirmationModal from "../ConfirmationModal";
import dltQuiz from "@/actions/DeleteQuizAction";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function ClientBuzrrs({ quizzes }: { quizzes: Quiz[] }) {
  const router = useRouter();

  const view = useSelector((state: RootState) => state.gridListToggle.view);
  const className = view === "grid" ? "w-11 h-11" : "w-6 h-6";
  const { clicked, setClicked, points, setPoints } = useContextMenu();

  const [delModalOpen, setDelModalOpen] = useState(false);
  const [quizId, setQuizId] = useState("");

  async function deleteQuiz(quizId: string) {
    const result = await dltQuiz(quizId);
    if (result?.error) {
      const errorMsg = result.error || "Something went wrong";
      toast.error(errorMsg);
    } else {
      toast.success("Successfully deleted quiz");
    }
    setDelModalOpen(false);
  }

  return (
    <>
      <div
        className={clsx(
          "flex gap-3 w-full mt-4 md:max-h-[60vh] overflow-y-auto",
          view === "list" ? "flex-col" : "flex-row flex-wrap"
        )}
      >
        <Link
          href="/admin/quiz/createQuiz"
          className={clsx(
            "border border-[#c2b4fe] dark:border-transparent w-full bg-card-light hover:bg-cardhover-light dark:bg-card-dark hover:dark:bg-cardhover-dark transition-all duration-300 ease-in-out text-dark dark:text-white rounded flex justify-center items-center",
            view === "list" ? "md:w-full flex-row gap-x-3 md:gap-x-1 py-4 px-2" : "p-2 flex-col md:w-40 h-[50vh] md:h-44"
          )}
        >
          <div className="h-full w-full flex gap-x-4 justify-center items-center">
            <ClientImage
              props={{
                src: "/images/add.svg",
                darksrc: "/images/add-dark.svg",
                alt: "Create Quiz",
                width: 45,
                height: 45,
                classname: className,
              }}
            />

            {view === "list" && (
              <div className="text-base font-bold w-full">
                Create a new quiz
              </div>
            )}
          </div>
          {view === "grid" && (
            <div className="text-xs font-bold w-full">Create a new quiz</div>
          )}
          <div
            className={clsx(view === "grid" ? "text-xs" : "text-base", "w-full")}
          >
            Build from the ground up
          </div>
        </Link>
        <Link
          href="#"
          className={clsx(
            "border border-[#c2b4fe] dark:border-transparent w-full bg-card-light hover:bg-cardhover-light dark:bg-card-dark hover:dark:bg-cardhover-dark transition-all duration-300 ease-in-out text-dark dark:text-white rounded flex justify-center items-center",
            view === "list" ? "md:w-full flex-row gap-x-3 md:gap-x-1 py-4 px-2" : "p-2 flex-col md:w-40 h-[50vh] md:h-44"
          )}
        >
          <div className="h-full w-full flex gap-x-4 justify-center items-center">
            <ClientImage
              props={{
                src: "/images/download.svg",
                darksrc: "/images/download-dark.svg",
                alt: "Import Quiz",
                width: 45,
                height: 45,
                classname: className,
              }}
            />
            {view === "list" && (
              <div className="text-base font-bold w-full">
                Import an existing quiz
              </div>
            )}
          </div>
          {view === "grid" && (
            <div className="text-xs font-bold w-full">
              Import an existing quiz
            </div>
          )}
          <div
            className={clsx(view === "grid" ? "text-xs" : "text-base", "w-full")}
          >
            Coming soon...
          </div>
        </Link>
        <CreateAIQuiz />
        {quizzes.map((quiz) => (
          <Link
            href={`/admin/quiz/${quiz.id}`}
            key={quiz.id}
            onContextMenu={(e) => {
              e.preventDefault();
              setClicked(true);
              setPoints({ x: e.pageX, y: e.pageY });
              setQuizId(quiz.id);
              console.log("right click", e.pageX, e.pageY);
            }}
            className={clsx(
              "border border-[#c2b4fe] dark:border-transparent w-full bg-card-light hover:bg-cardhover-light dark:bg-card-dark hover:dark:bg-cardhover-dark transition-all duration-300 ease-in-out text-dark dark:text-white rounded flex items-center",
              view === "list" ? "md:w-full flex-row gap-x-3 md:gap-x-1 py-4 px-2" : "p-2 flex-col md:w-40 h-[50vh] md:h-44"
            )}
          >
            <h2 className="text-md font-bold dark:text-white w-full">
              {quiz.title}
            </h2>
            <p
              className={clsx(view === "grid" ? "text-xs" : "text-base", "w-full text-off-dark dark:text-off-white")}
            >
              {quiz.description}
            </p>
          </Link>
        ))}
        {clicked && (
          <div
            className="absolute z-50 text-sm bg-white dark:bg-dark rounded-lg shadow-lg border border-[#DADADD] dark:border-[#3A3A3A]"
            style={{ top: points.y, left: points.x }}
          >
            <div
              className="px-8 py-1 m-1 rounded-md text-dark dark:text-white hover:bg-card-light dark:hover:bg-off-dark cursor-pointer"
              onClick={() => {
                router.push(`/admin/quiz/${quizId}`);
              }}
            >
              Open
            </div>
            <div
              className="px-8 py-1 rounded-md text-red-light m-1 hover:bg-card-light dark:hover:bg-off-dark cursor-pointer"
              onClick={() => setDelModalOpen(true)}
            >
              Delete
            </div>
          </div>
        )}
      </div>
      <ConfirmationModal
        open={delModalOpen}
        setOpen={setDelModalOpen}
        onClick={() => {
          deleteQuiz(quizId);
        }}
        desc="Are you sure you want to delete this quiz?"
      />
    </>
  );
}
