"use client";
import { useEffect } from "react";
import { useAppDispatch } from "@/state/hooks";
import { setScreenStatus, ScreenStatus } from "@/state/player/screenSlice";

const ResetReduxStates = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (typeof window !== "undefined") {
      dispatch(setScreenStatus(ScreenStatus.lobby));
    }
  }, [dispatch]);
  return <></>;
};

export default ResetReduxStates;
