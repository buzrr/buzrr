"use client";

import clsx from "clsx";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type BaseProps = {
  label?: string;
  labelClassName?: string;
  error?: string;
  containerClassName?: string;
};

type InputProps = BaseProps &
  InputHTMLAttributes<HTMLInputElement> & {
    textarea?: false;
  };

type TextAreaProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    textarea: true;
  };

export type TextInputProps = InputProps | TextAreaProps;

export function TextInput(props: TextInputProps) {
  const {
    label,
    labelClassName,
    error,
    containerClassName,
    className,
    id,
    ...rest
  } = props;

  const fieldId = id ?? (typeof props.name === "string" ? props.name : undefined);
  const describedBy = error && fieldId ? `${fieldId}-error` : undefined;

  const baseClassName =
    "w-full border border-gray rounded-lg outline-none text-dark dark:text-white dark:bg-dark-bg focus:border-blue-600 px-4 py-3";

  return (
    <div className={clsx("flex flex-col", containerClassName)}>
      {label ? (
        <label
          htmlFor={fieldId}
          className={clsx("text-sm text-dark dark:text-white mb-1", labelClassName)}
        >
          {label}
        </label>
      ) : null}
      {props.textarea ? (
        <textarea
          id={fieldId}
          className={clsx(baseClassName, "min-h-20 max-h-40", className)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...rest}
        />
      ) : (
        <input
          id={fieldId}
          className={clsx(baseClassName, className)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
      {error && fieldId ? (
        <p id={`${fieldId}-error`} className="text-sm text-red-500 mt-1" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default TextInput;
