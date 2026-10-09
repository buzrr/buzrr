"use client";

import clsx from "clsx";
import ShowMedia from "./ShowMediaComp";
import Image from "next/image";
import { LuClock, LuGripVertical } from "react-icons/lu";
import AddQuesForm from "./AddQuesForm";
import BasicModal from "@/components/Modal";
import { toast } from "react-toastify";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { queryKeys } from "@/lib/modules/query-keys";
import ConfirmationModal from "../ConfirmationModal";
import { useAppSelector } from "@/state/hooks";
import { HideQuestions } from "@/state/hideQuestionsSlice";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { QuestionWithOptions } from "@/lib/modules/questions/api";
import {
  useDeleteQuestionMutation,
  useQuestionsQuery,
  useReorderQuestionsMutation,
} from "@/lib/modules/questions/hooks";

type QuestionRow = QuestionWithOptions;

export default function AllQues(props: { quizId: string }) {
  const queryClient = useQueryClient();
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

    const from = result.source.index;
    const to = result.destination.index;
    const dragId = questions[from]?.id;
    const dropId = questions[to]?.id;
    if (!dragId || !dropId || dragId === dropId) return;

    // Optimistically move the dragged row to its new slot so the list
    // doesn't snap back while the server reorders.
    const reordered = [...questions];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    queryClient.setQueryData(queryKeys.questions(props.quizId), {
      status: 200,
      questions: reordered.map((q, index) => ({ ...q, order: index + 1 })),
    });

    try {
      await reorderMutation.mutateAsync({
        dragQuesId: dragId,
        dropQuesId: dropId,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions(props.quizId),
      });
    }
  }

  const visibility = useAppSelector((state) => state.hideQuestions.visibility);

  if (isError) {
    return (
      <div className="p-4 text-red-500">
        Failed to load questions. Try again.
      </div>
    );
  }

  if (isPending) {
    return (
      <div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-44 w-full rounded-[18px] animate-pulse bg-lprimary/10 dark:bg-white/10"
            />
          ))}
        </div>
      </div>
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
              className={clsx(
                "w-full min-w-0",
                visibility === HideQuestions.hide &&
                  "blur-lg pointer-events-none",
              )}
            >
              {questions.length > 0 ? (
                questions.map((ques, index) => (
                  <Draggable key={ques.id} draggableId={ques.id} index={index}>
                    {(provided) => (
                      <div
                        className="w-full mb-4"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <div className="relative rounded-[18px] overflow-hidden border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 transition-[border-color,box-shadow] hover:border-lprimary dark:hover:border-dprimary hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.5)]">
                          <div className="flex gap-3.5 px-4 md:px-[22px] pt-4 md:pt-5 pb-4">
                            <span className="hidden md:flex shrink-0 pt-[3px] cursor-grab text-[#8a8896] dark:text-muted-dark">
                              <LuGripVertical size={18} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-3.5">
                                <p className="text-base md:text-[17px] font-bold leading-[1.35] wrap-break-word min-w-0">
                                  <span className="text-lprimary dark:text-dprimary">
                                    {index + 1}.
                                  </span>{" "}
                                  {ques?.title}
                                </p>
                                <span className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[13px] font-bold bg-lprimary/10 dark:bg-white/5">
                                  <LuClock size={14} />
                                  {ques?.timeOut} sec
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {ques?.options?.map(
                                  (
                                    op: { title?: string; isCorrect?: boolean },
                                    opIndex: number,
                                  ) => (
                                    <p
                                      key={opIndex}
                                      className={clsx(
                                        "flex items-center gap-[11px] rounded-xl border-[1.5px] px-3.5 py-3 text-[14.5px] wrap-break-word min-w-0",
                                        op.isCorrect
                                          ? "font-semibold border-lprimary dark:border-dprimary bg-lprimary/10 dark:bg-dprimary/15"
                                          : "font-medium border-lprimary/15 dark:border-white/10",
                                      )}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={clsx(
                                          "relative size-5 shrink-0 rounded-full border-2",
                                          op.isCorrect
                                            ? "border-lprimary dark:border-dprimary after:absolute after:inset-[3px] after:rounded-full after:bg-lprimary dark:after:bg-dprimary"
                                            : "border-[#8a8896] dark:border-off-dark",
                                        )}
                                      />
                                      <span className="min-w-0">
                                        {op.title}
                                      </span>
                                      {op.isCorrect && (
                                        <span className="sr-only">
                                          (correct)
                                        </span>
                                      )}
                                    </p>
                                  ),
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-[22px] px-4 md:px-[22px] py-3 bg-lprimary/10 dark:bg-dprimary/10 border-t border-lprimary/15 dark:border-white/10">
                            <button
                              type="button"
                              className="text-sm font-semibold text-red-light dark:text-red-dark hover:underline cursor-pointer"
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
                              subtitle={`Question ${index + 1} · changes apply the next time you host.`}
                              btnStyle="text-sm font-semibold text-lprimary dark:text-dprimary hover:underline cursor-pointer"
                            >
                              {(close) => (
                                <AddQuesForm
                                  quizId={props.quizId}
                                  question={ques}
                                  onDone={close}
                                />
                              )}
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
