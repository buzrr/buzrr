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
  /** When set, overrides react-dom useFormStatus (needed for React Hook Form + mutations). */
  isPending?: boolean;
}) => {
  const { pending } = useFormStatus();
  const isLoading = params.isPending ?? pending;
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
      type="submit"
      disabled={params.error || isLoading}
      value="submit"
      className="rounded-xl text-white dark:text-dark w-full bg-lprimary dark:bg-dprimary px-5 py-3 hover:cursor-pointer transition-all duration-300 ease-in-out disabled:cursor-default font-bold disabled:bg-gray dark:disabled:bg-gray"
      onClick={handleRedux}
    >
      {isLoading ? params.loader || "Loading..." : params.text || "Next"}
    </button>
  );
};

export default SubmitButton;
