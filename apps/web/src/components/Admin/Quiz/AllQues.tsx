"use client";

import ShowMedia from "./ShowMediaComp";
import Image from "next/image";
import AddQuesForm from "./AddQuesForm";
import BasicModal from "@/components/Modal";
import dltQuestion from "@/actions/DltQuesAction";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import getAllQuestion from "@/actions/GetAllQues";
import reOrderQuestion from "@/actions/ReorderQuesAction";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ConfirmationModal from "../ConfirmationModal";
import ClientImage from "@/components/ClientImage";
import { RootState } from "@/state/store";
import { useSelector } from "react-redux";
import { hideQuestions } from "@/state/hideQuestionsSlice";

export default function AllQues(props: { quizId: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [delQuesModalOpen, setDelQuesModalOpen] = useState(false);
  const [delQuesId, setDelQuesId] = useState("");

  useEffect(() => {
    async function fetchQues() {
      try {
        const result: any = await getAllQuestion(props.quizId);
        if (result.status == 200) {
          setQuestions(result.questions);
        }
      } catch (err) {}
    }
    fetchQues();
  }, [props.quizId]);

  async function clientDltAction(quesId: string) {
    const result = await dltQuestion(quesId);
    if (result?.error) {
      const errorMsg = result.error || "Something went wrong";
      toast.error(errorMsg);
    } else {
      toast.success("Question deleted successfully");
      setDelQuesModalOpen(false);
      const newQuestions = questions.filter((ques) => ques.id !== quesId);
      setQuestions(newQuestions);
    }
  }

  const reorder = (
    list: any,
    startIndex: number,
    endIndex: number,
    dragId: string,
    dropId: string,
  ) => {
    reOrderQuestion({
      dragQuesId: dragId,
      dropQuesId: dropId,
    });

    const dragBox = questions.find((box: any) => box?.id === dragId);
    const dropBox = questions.find((box: any) => box.id === dropId);

    const dragBoxOrder = dragBox?.order;
    const dropBoxOrder = dropBox?.order;

    const result = questions.map((box: any) => {
      if (box.id === dragId) {
        box.order = dropBoxOrder;
      }
      if (box.id === dropId) {
        box.order = dragBoxOrder;
      }
      return box;
    });

    return result;
  };

  function onDragEnd(result: any) {
    if (!result.destination) {
      return;
    }

    const dragId = questions[result.source.index].id;
    const dropId = questions[result.destination.index].id;

    const items = reorder(
      questions,
      result.source.index,
      result.destination.index,
      dragId,
      dropId,
    );

    setQuestions(items);
  }

  const visibility = useSelector(
    (state: RootState) => state.hideQuestions.visibility,
  );

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="drop">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`overflow-x-auto h-[90%] ${visibility === hideQuestions.hide ? "blur-lg pointer-events-none" : ""}`}
            >
              {questions.length > 0 ? (
                questions
                  .sort((a, b) => a.order - b.order)
                  .map((ques, index) => (
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
                              draggable="false"
                            />
                          </div>
                          <div className="bg-[#f5f5f5] dark:bg-[#3b3c3f] rounded-xl w-full">
                            <div className="p-3">
                              <div className="flex flex-col">
                                <div className="flex justify-between items-center">
                                  <p className="text-md font-semibold flex items-center w-[70%] break-words">
                                    {index + 1}. {ques?.title}
                                  </p>
                                  <p className="text-sm text-dark font-black p-1 rounded-md bg-[#dadadd] dark:text-white dark:bg-transparent w-fit">
                                    {ques?.timeOut} sec
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col md:grid md:grid-cols-4">
                                {ques?.options?.map(
                                  (op: any, index: number) => {
                                    return (
                                      <p
                                        key={index}
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
                            <div className="bg-[#ede9fe] dark:bg-[#332d40] p-2 px-3 rounded-b-xl">
                              <div className="flex [&>*]:text-xs [&>*]:font-semibold">
                                <button
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
                                    mediaType={ques.mediaType || ""}
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
