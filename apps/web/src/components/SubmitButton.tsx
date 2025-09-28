"use client";
import {
  setCurrIndex,
  setLeaderboard,
  setPlayers,
  setResult,
} from "@/state/admin/playersSlice";
import { useFormStatus } from "react-dom";
import { useDispatch } from "react-redux";

const SubmitButton = (params: {
  text?: string;
  loader?: string;
  style?: string;
  isQuiz?: boolean;
  error?: boolean;
}) => {
  const { pending } = useFormStatus();
  const dispatch = useDispatch();

  function handleRedux() {
    if (params.isQuiz) {
      dispatch(setPlayers([]));
      dispatch(setLeaderboard([]));
      dispatch(setResult([]));
      dispatch(setCurrIndex(0));
    }
  }
  return (
    <button
      disabled={params.error || pending}
      value="submit"
      className="rounded-xl text-white dark:text-dark w-full bg-lprimary dark:bg-dprimary px-5 py-3 hover:cursor-pointer transition-all duration-300 ease-in-out disabled:cursor-default font-bold disabled:bg-gray dark:disabled:bg-gray"
      onClick={handleRedux}
    >
      {pending ? params.loader || "Loading..." : params.text || "Next"}
    </button>
  );
};

export default SubmitButton;
