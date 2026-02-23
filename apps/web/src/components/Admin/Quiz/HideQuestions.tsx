"use client";
import clsx from "clsx";
import { useEffect } from "react";
import { RootState } from "@/state/store";
import { useSelector, useDispatch } from "react-redux";
import { hideQuestions, setHideQuestions } from "@/state/hideQuestionsSlice";

const HideQuestions = () => {
  const dispatch = useDispatch();

  const visibility = useSelector(
    (state: RootState) => state.hideQuestions.visibility,
  );

  useEffect(() => {
    dispatch(setHideQuestions(hideQuestions.hide));
    // Only set hidden on initial mount when visiting the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = () => {
    dispatch(
      setHideQuestions(
        visibility === hideQuestions.hide
          ? hideQuestions.show
          : hideQuestions.hide,
      ),
    );
  };

  return (
    <div className="flex items-center px-4 py-2 rounded-md hover:bg-cardhover-light dark:hover:bg-cardhover-dark gap-2">
      <div className="text-nowrap">Hide Questions</div>
      <div
        className={clsx(
          "w-8 h-5 rounded-full hideques:bg-dprimary flex items-center p-1 cursor-pointer",
          visibility === hideQuestions.show ? "bg-[#abacaf]" : "bg-lprimary"
        )}
        onClick={handle}
      >
        <div
          className={clsx(
            "w-3 h-3 bg-white rounded-full transition-all duration-200 ease-in-out",
            visibility === hideQuestions.hide ? "ml-[50%]" : "ml-0"
          )}
        ></div>
      </div>
    </div>
  );
};

export default HideQuestions;
