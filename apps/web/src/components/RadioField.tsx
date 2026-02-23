"use client";
import { useState, useEffect } from "react";
import { useFormStatus } from "react-dom";

export const RadioField = (props: { defaultvalue?: string; val: string }) => {
  const { pending } = useFormStatus();
  const [value, setValue] = useState("");
  const { defaultvalue, val } = props;

  useEffect(() => {
    if (defaultvalue) {
      const element = document.getElementById(defaultvalue) as HTMLInputElement;
      element.checked = true;
      setValue(defaultvalue);
    } else setValue("");
  }, [defaultvalue]);

  useEffect(() => {
    if (pending) {
      setValue("");
      const element = document.getElementById(val) as HTMLInputElement;
      element.checked = false;
    }
  }, [pending, val]);

  return (
    <input
      required
      id={val}
      type="radio"
      className="absolute top-[26px] right-2"
      name="choose_option"
      value={value}
      onChange={() => setValue(val)}
    />
  );
};
