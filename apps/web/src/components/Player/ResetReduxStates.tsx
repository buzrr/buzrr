"use client";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setScreenStatus, ScreenStatus } from "@/state/player/screenSlice";

const ResetReduxStates = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    if (window !== undefined) {
      dispatch(setScreenStatus(ScreenStatus.lobby));
    }
  }, [dispatch]);
  return <></>;
};

export default ResetReduxStates;
