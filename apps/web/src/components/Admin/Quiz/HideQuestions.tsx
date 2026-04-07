"use client";
import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/state/hooks";
import { HideQuestions as HideQuestionsEnum, setHideQuestions } from "@/state/hideQuestionsSlice";
import { Switch } from "@/components/ui/Switch";

const HideQuestions = () => {
  const dispatch = useAppDispatch();

  const visibility = useAppSelector(
    (state) => state.hideQuestions.visibility,
  );

  useEffect(() => {
    dispatch(setHideQuestions(HideQuestionsEnum.hide));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = () => {
    dispatch(
      setHideQuestions(
        visibility === HideQuestionsEnum.hide
          ? HideQuestionsEnum.show
          : HideQuestionsEnum.hide,
      ),
    );
  };

  const isHidden = visibility === HideQuestionsEnum.hide;

  return (
    <div className="flex items-center px-4 py-2 rounded-md hover:bg-cardhover-light dark:hover:bg-cardhover-dark gap-2">
      <span className="text-nowrap">Hide Questions</span>
      <Switch
        checked={isHidden}
        aria-label="Hide questions"
        className="cursor-pointer"
        onClick={handle}
      />
    </div>
  );
};

export default HideQuestions;
