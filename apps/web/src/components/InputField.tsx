"use client";

import clsx from "clsx";
import { useState, useEffect, useId } from "react";
import { useFormStatus } from "react-dom";

/** Visual style variant (maps to legacy `style` prop) */
export type InputFieldVariant = "default" | "playerName" | "question";

/** Size variant */
export type InputFieldSize = "sm" | "md" | "lg";

export interface InputFieldProps {
  type: string;
  name: string;
  maxNum?: number;
  maxLength?: number;
  placeholder: string;
  autoComplete: string;
  className?: string;
  required?: boolean;
  /** @deprecated Use `variant` instead. Kept for backward compatibility. */
  style?: "playerName" | "question";
  /** Visual variant: default (rounded-full), playerName (bordered), question (narrow) */
  variant?: InputFieldVariant;
  /** Size variant */
  size?: InputFieldSize;
  accept?: string;
  textarea?: boolean;
  onTitleChange?: (value: string) => void;
  label?: string;
  labelClass?: string;
  fieldValue?: string;
  /** Show error state and optional message */
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
}

const sizeClasses: Record<InputFieldSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-3",
  lg: "px-4 py-3.5 text-lg",
};

const variantInputClasses: Record<InputFieldVariant, string> = {
  default: "w-full rounded-full",
  playerName:
    "w-full border-black border-2 focus:border-blue-600 rounded-lg outline-none md:w-4/5",
  question: "w-4/5 rounded-full",
};

export function InputField(props: InputFieldProps) {
  const { pending } = useFormStatus();
  const [uncontrolledValue, setUncontrolledValue] = useState("");
  const inputId = useId();
  const variant: InputFieldVariant =
    props.variant ?? (props.style as InputFieldVariant | undefined) ?? "default";
  const size = props.size ?? "md";

  /** When `fieldValue` is passed (including ""), the parent owns the value — avoids desync with react-hook-form and prevents useFormStatus `pending` from clearing the visible value on submit. */
  const controlled = props.fieldValue !== undefined;
  const displayValue = controlled ? (props.fieldValue ?? "") : uncontrolledValue;

  useEffect(() => {
    if (pending && !controlled) {
      setUncontrolledValue("");
    }
  }, [pending, controlled]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    props.onTitleChange?.(v);
    if (!controlled) {
      setUncontrolledValue(v);
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    props.onTitleChange?.(v);
    if (!controlled) {
      setUncontrolledValue(v);
    }
  }

  const baseInputClasses =
    "text-slate-900 my-2 focus:bg-[#EEEEF0] focus:outline-none focus:dark:bg-[#27272A]";
  const variantClasses = variantInputClasses[variant];
  const sizeClassesStr = sizeClasses[size];

  const inputClassName = clsx(
    baseInputClasses,
    variantClasses,
    sizeClassesStr,
    props.error && "border-2 border-red-500 dark:border-red-400",
    props.disabled && "opacity-60 cursor-not-allowed",
    props.accept && "text-white",
    props.className
  );

  const textareaClassName = clsx(
    baseInputClasses,
    sizeClassesStr,
    "rounded-lg max-h-40 min-h-20",
    props.error && "border-2 border-red-500 dark:border-red-400",
    props.disabled && "opacity-60 cursor-not-allowed",
    props.className
  );

  return (
    <div className="flex flex-col mb-3">
      {props.label && (
        <label
          className={clsx("text-sm text-dark dark:text-white mb-0", props.labelClass)}
          htmlFor={inputId}
        >
          {props.label}
        </label>
      )}
      {props.textarea ? (
        <textarea
          id={inputId}
          name={props.name}
          value={displayValue}
          onChange={handleTextareaChange}
          autoCorrect="off"
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          required={props.required ?? false}
          className={textareaClassName}
          maxLength={props.maxLength ?? 100}
          disabled={props.disabled}
          aria-invalid={props.error}
          aria-describedby={props.error && props.errorMessage ? `${props.name}-error` : undefined}
        />
      ) : (
        <input
          id={inputId}
          type={props.type}
          name={props.name}
          autoCorrect="off"
          value={displayValue}
          onChange={handleInput}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          required={props.required ?? false}
          className={inputClassName}
          accept={props.accept}
          min={props.type === "number" ? 1 : undefined}
          max={props.maxNum}
          maxLength={props.maxLength ?? 50}
          disabled={props.disabled}
          aria-invalid={props.error}
          aria-describedby={props.error && props.errorMessage ? `${props.name}-error` : undefined}
        />
      )}
      {props.error && props.errorMessage && (
        <p
          id={`${props.name}-error`}
          className="text-sm text-red-500 dark:text-red-400 mt-1"
          role="alert"
        >
          {props.errorMessage}
        </p>
      )}
    </div>
  );
}

export default InputField;
