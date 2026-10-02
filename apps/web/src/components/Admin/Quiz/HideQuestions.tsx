"use client";
import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/state/hooks";
import {
  HideQuestions as HideQuestionsEnum,
  setHideQuestions,
} from "@/state/hideQuestionsSlice";
import { Switch } from "@/components/ui/Switch";

const HideQuestions = () => {
  const dispatch = useAppDispatch();

  const visibility = useAppSelector((state) => state.hideQuestions.visibility);

  useEffect(() => {
    dispatch(setHideQuestions(HideQuestionsEnum.hide));
  }, [dispatch]);

  const handle = (checked: boolean) => {
    dispatch(
      setHideQuestions(
        checked ? HideQuestionsEnum.hide : HideQuestionsEnum.show,
      ),
    );
  };

  const isHidden = visibility === HideQuestionsEnum.hide;

  return (
    <div className="flex items-center gap-3 shrink-0 whitespace-nowrap px-3.5 md:px-[18px] py-3 md:py-[13px] rounded-[14px] text-sm md:text-[14.5px] font-semibold bg-light-bg dark:bg-card-dark border border-lprimary/15 dark:border-white/5">
      <span>Hide Questions</span>
      <Switch
        checked={isHidden}
        aria-label="Hide questions"
        className="cursor-pointer"
        onCheckedChange={handle}
      />
    </div>
  );
};

export default HideQuestions;
