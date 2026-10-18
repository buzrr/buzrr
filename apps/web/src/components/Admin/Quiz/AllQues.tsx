"use client";

import clsx from "clsx";
import { isUnlimitedTime } from "@buzrr/contract";
import ShowMedia from "./ShowMediaComp";
import Image from "next/image";
import { LuClock, LuGripVertical, LuImage, LuMusic } from "react-icons/lu";
import AddQuesForm from "./AddQuesForm";
import QuestionCardBody, {
  QuestionTypeTag,
  cardType,
} from "./QuestionCardBody";
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
import { useT } from "@/lib/i18n/context";
import {
  useDeleteQuestionMutation,
  useQuestionsQuery,
  useSetQuestionDisabledMutation,
  useReorderQuestionsMutation,
} from "@/lib/modules/questions/hooks";

type QuestionRow = QuestionWithOptions;

export default function AllQues(props: { quizId: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuestionsQuery(props.quizId);
  const reorderMutation = useReorderQuestionsMutation(props.quizId);
  const deleteMutation = useDeleteQuestionMutation(props.quizId);
  const disableMutation = useSetQuestionDisabledMutation(props.quizId);

  const questions = useMemo(() => {
    const list = (data?.questions ?? []) as QuestionRow[];
    return [...list].sort((a, b) => a.order - b.order);
  }, [data?.questions]);
  // Numbered as played: disabled questions are skipped.
  const playNumber = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const q of questions) if (!q.disabled) m.set(q.id, ++n);
    return m;
  }, [questions]);

  const [delQuesModalOpen, setDelQuesModalOpen] = useState(false);
  const [delQuesId, setDelQuesId] = useState("");

  function clientDltAction(quesId: string) {
    deleteMutation.mutate(quesId, {
      onSuccess: () => {
        toast.success(t("Question deleted successfully"));
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
        {t("Failed to load questions. Try again.")}
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
                        <div
                          className={clsx(
                            "relative rounded-[18px] overflow-hidden border transition-[border-color,box-shadow] hover:border-lprimary dark:hover:border-dprimary hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.5)]",
                            ques.disabled
                              ? "border-dashed bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(120,120,140,0.07)_10px_20px)] bg-black/[0.03] dark:bg-white/[0.02] border-lprimary/20 dark:border-white/10"
                              : "bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5",
                          )}
                        >
                          <div
                            className={clsx(
                              "flex gap-3.5 px-4 md:px-[22px] pt-4 md:pt-5 pb-4",
                              ques.disabled && "opacity-45 grayscale",
                            )}
                          >
                            <span className="hidden md:flex shrink-0 pt-[3px] cursor-grab text-[#8a8896] dark:text-muted-dark">
                              <LuGripVertical size={18} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-3.5">
                                <p className="text-base md:text-[17px] font-bold leading-[1.35] wrap-break-word min-w-0">
                                  <span className="text-lprimary dark:text-dprimary">
                                    {ques.disabled
                                      ? "–"
                                      : `${playNumber.get(ques.id)}.`}
                                  </span>{" "}
                                  {ques?.title}
                                </p>
                                <div className="shrink-0 flex flex-col md:flex-row items-end md:items-center gap-1.5">
                                  <QuestionTypeTag type={cardType(ques)} />
                                  <span className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[13px] font-bold bg-lprimary/10 dark:bg-white/5">
                                    <LuClock size={14} />
                                    {isUnlimitedTime(ques?.timeOut)
                                      ? "∞"
                                      : t("{n} sec", { n: ques?.timeOut ?? 0 })}
                                  </span>
                                </div>
                              </div>
                              <QuestionCardBody question={ques} />
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
                              {t("Delete")}
                            </button>
                            <button
                              type="button"
                              disabled={disableMutation.isPending}
                              className="text-sm font-semibold text-off-dark dark:text-muted-dark hover:underline cursor-pointer disabled:opacity-60"
                              onClick={() =>
                                disableMutation.mutate(
                                  {
                                    questionId: ques.id,
                                    disabled: !ques.disabled,
                                  },
                                  {
                                    onError: (err) =>
                                      toast.error(getApiErrorMessage(err)),
                                  },
                                )
                              }
                            >
                              {ques.disabled ? t("Enable") : t("Disable")}
                            </button>
                            <BasicModal
                              isEdit={true}
                              wide
                              confirmDismiss
                              btnTitle={t("Edit Question")}
                              subtitle={t(
                                "Question {n} · changes apply the next time you host.",
                                { n: index + 1 },
                              )}
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
                            <span className="ml-auto flex items-center gap-2.5 text-off-dark dark:text-muted-dark">
                              {ques.disabled && (
                                <span className="text-xs font-bold tracking-[0.06em] uppercase rounded-full px-2.5 py-0.5 bg-black/10 dark:bg-white/10">
                                  {t("Disabled · skipped")}
                                </span>
                              )}
                              {/* What the question brings along. */}
                              {ques.audio && (
                                <LuMusic
                                  size={17}
                                  aria-label={t("With music")}
                                  role="img"
                                />
                              )}
                              {/* The picture: its icon (opens it too), a
                                  little gap, then "View image". */}
                              {ques.media && (
                                <ShowMedia
                                  media={ques.media}
                                  mediaType={ques.mediaType ?? ""}
                                  icon={
                                    ques.mediaType !== "audio" ? (
                                      <LuImage size={17} />
                                    ) : undefined
                                  }
                                />
                              )}
                            </span>
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
                      alt={t("no-questions")}
                      width={200}
                      height={200}
                    />
                  </div>
                  <div className="font-black text-lg">
                    {t("No Questions Added Yet!")}
                  </div>
                  <div className="text-md w-[40%] text-center">
                    {t(
                      "It looks like there are no questions for this quiz. Start adding questions to engage your students and make learning fun!",
                    )}
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
        desc={t("Are you sure you want to delete this question?")}
      />
    </>
  );
}
