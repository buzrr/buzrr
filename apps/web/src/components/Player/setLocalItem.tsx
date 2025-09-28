"use client";
import { useEffect } from "react";

export default function SetLocalItem(params: {
  mapKey: string;
  value: string;
}) {
  useEffect(() => {
    if (window !== undefined) {
      window.localStorage.setItem(params.mapKey, params.value);
    }
  }, [params.mapKey, params.value]);

  return <></>;
}
