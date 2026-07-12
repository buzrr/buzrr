"use client";
import { useEffect } from "react";
import { useAppDispatch } from "@/state/hooks";
import { resetGame } from "@/state/game/gameSlice";

const ResetReduxStates = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (typeof window !== "undefined") {
      dispatch(resetGame());
    }
  }, [dispatch]);
  return <></>;
};

export default ResetReduxStates;
