"use client";

import clsx from "clsx";
import ShowMedia from "./ShowMediaComp";
import Image from "next/image";
import AddQuesForm from "./AddQuesForm";
import BasicModal from "@/components/Modal";
import { toast } from "react-toastify";
import { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ConfirmationModal from "../ConfirmationModal";
import ClientImage from "@/components/ClientImage";
import { RootState } from "@/state/store";
import { useSelector } from "react-redux";
import { hideQuestions } from "@/state/hideQuestionsSlice";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { QuestionWithOptions } from "@/lib/modules/questions/api";
import {
  useDeleteQuestionMutation,
  useQuestionsQuery,
  useReorderQuestionsMutation,
} from "@/lib/modules/questions/hooks";

type QuestionRow = QuestionWithOptions;

export default function AllQues(props: { quizId: string }) {
  const { data, isPending, isError } = useQuestionsQuery(props.quizId);
  const reorderMutation = useReorderQuestionsMutation(props.quizId);
  const deleteMutation = useDeleteQuestionMutation(props.quizId);

  const questions = useMemo(() => {
    const list = (data?.questions ?? []) as QuestionRow[];
    return [...list].sort((a, b) => a.order - b.order);
  }, [data?.questions]);

  const [delQuesModalOpen, setDelQuesModalOpen] = useState(false);
  const [delQuesId, setDelQuesId] = useState("");

  function clientDltAction(quesId: string) {
    deleteMutation.mutate(quesId, {
      onSuccess: () => {
        toast.success("Question deleted successfully");
        setDelQuesModalOpen(false);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
    });
  }

  async function onDragEnd(result: {
    destination: { index: number } | null;
    source: { index: number };
  }) {
    if (!result.destination) {
      return;
    }

    const dragId = questions[result.source.index]?.id;
    const dropId = questions[result.destination.index]?.id;
    if (!dragId || !dropId || dragId === dropId) return;

    try {
      await reorderMutation.mutateAsync({
        dragQuesId: dragId,
        dropQuesId: dropId,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const visibility = useSelector(
    (state: RootState) => state.hideQuestions.visibility,
  );

  if (isError) {
    return (
      <div className="p-4 text-red-500">Failed to load questions. Try again.</div>
    );
  }

  if (isPending) {
    return (
      <div className="p-4 text-dark dark:text-white">Loading questions…</div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="drop">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={clsx("overflow-x-auto md:h-[90%]", visibility === hideQuestions.hide && "blur-lg pointer-events-none")}
            >
              {questions.length > 0 ? (
                questions.map((ques, index) => (
                    <Draggable
                      key={ques.id}
                      draggableId={ques.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          className="w-full my-2 flex items-center"
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <div className="p-2 cursor-grab hidden md:block">
                            <Image
                              src="/images/selection-indicator.svg"
                              alt="selection-indicator"
                              width={20}
                              height={20}
                              draggable={false}
                            />
                          </div>
                          <div className="bg-[#f5f5f5] dark:bg-[#3b3c3f] rounded-xl w-full">
                            <div className="p-3">
                              <div className="flex flex-col">
                                <div className="flex justify-between items-center">
                                  <p className="text-md font-semibold flex items-center w-[70%] wrap-break-word">
                                    {index + 1}. {ques?.title}
                                  </p>
                                  <p className="text-sm text-dark font-black p-1 rounded-md bg-[#dadadd] dark:text-white dark:bg-transparent w-fit">
                                    {ques?.timeOut} sec
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col md:grid md:grid-cols-4">
                                {ques?.options?.map(
                                  (op: { title?: string; isCorrect?: boolean }, opIndex: number) => {
                                    return (
                                      <p
                                        key={opIndex}
                                        className="break-word text-md my-2 flex items-center"
                                      >
                                        {op.isCorrect ? (
                                          <ClientImage
                                            props={{
                                              src: "/images/radio-btn-selected.svg",
                                              darksrc:
                                                "/images/radio-btn-dark-selected.svg",
                                              alt: "option",
                                              width: 25,
                                              height: 25,
                                            }}
                                          />
                                        ) : (
                                          <ClientImage
                                            props={{
                                              src: "/images/radio-btn.svg",
                                              darksrc:
                                                "/images/radio-btn-dark.svg",
                                              alt: "option",
                                              width: 25,
                                              height: 25,
                                            }}
                                          />
                                        )}
                                        <span>{op.title}</span>
                                      </p>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                            <div className="bg-card-light dark:bg-[#332d40] p-2 px-3 rounded-b-xl">
                              <div className="flex *:text-xs *:font-semibold">
                                <button
                                  type="button"
                                  className="p-1 mr-1 text-red-light hover:bg-[#fccccc] rounded-md"
                                  onClick={() => {
                                    setDelQuesId(ques.id);
                                    setDelQuesModalOpen(true);
                                  }}
                                >
                                  Delete
                                </button>
                                <BasicModal
                                  isEdit={true}
                                  btnTitle="Edit Question"
                                >
                                  <AddQuesForm
                                    quizId={props.quizId}
                                    question={ques}
                                  />
                                </BasicModal>
                                {ques.media && (
                                  <ShowMedia
                                    media={ques.media}
                                    mediaType={ques.mediaType ?? ""}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))
              ) : (
                <div className="border-2 border-gray rounded-2xl border-dashed w-[95%] p-6 py-16 mt-8 mx-auto flex flex-col justify-center items-center">
                  <div className="w-full py-2 flex justify-center">
                    <Image
                      src="/images/no-questions.svg"
                      alt="no-questions"
                      width={200}
                      height={200}
                    />
                  </div>
                  <div className="font-black text-lg">
                    No Questions Added Yet!
                  </div>
                  <div className="text-md w-[40%] text-center">
                    It looks like there are no questions for this quiz. Start
                    adding questions to engage your students and make learning
                    fun!
                  </div>
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <ConfirmationModal
        open={delQuesModalOpen}
        setOpen={setDelQuesModalOpen}
        onClick={() => {
          clientDltAction(delQuesId);
        }}
        desc="Are you sure you want to delete this question?"
      />
    </>
  );
}
