"use client";

import clsx from "clsx";
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

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

type RenderFieldProps = {
  label?: string;
  labelClassName?: string;
  error?: string;
  containerClassName?: string;
  className?: string;
  fieldId?: string;
  describedBy?: string;
  renderControl: () => ReactNode;
};

function renderField({
  label,
  labelClassName,
  error,
  containerClassName,
  fieldId,
  renderControl,
}: RenderFieldProps) {
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
      {renderControl()}
      {error ? (
        <p
          {...(fieldId ? { id: `${fieldId}-error`, role: "alert" as const } : {})}
          className="text-sm text-red-500 mt-1"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: TextInputProps) {
  const baseClassName =
    "w-full border border-gray rounded-lg outline-none text-dark dark:text-white dark:bg-dark-bg focus:border-blue-600 px-4 py-3";

  if (props.textarea) {
    const {
      label,
      labelClassName,
      error,
      containerClassName,
      className,
      id,
      textarea: _textarea,
      ...textareaProps
    } = props;
    void _textarea;

    const fieldId = id ?? (typeof props.name === "string" ? props.name : undefined);
    const describedBy = error && fieldId ? `${fieldId}-error` : undefined;

    return renderField({
      label,
      labelClassName,
      error,
      containerClassName,
      fieldId,
      describedBy,
      renderControl: () => (
        <textarea
          id={fieldId}
          className={clsx(baseClassName, "min-h-20 max-h-40", className)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...textareaProps}
        />
      ),
    });
  }

  const {
    label,
    labelClassName,
    error,
    containerClassName,
    className,
    id,
    textarea: _textarea,
    ...inputProps
  } = props;
  void _textarea;
  const fieldId = id ?? (typeof props.name === "string" ? props.name : undefined);
  const describedBy = error && fieldId ? `${fieldId}-error` : undefined;

  return renderField({
    label,
    labelClassName,
    error,
    containerClassName,
    fieldId,
    describedBy,
    renderControl: () => (
      <input
        id={fieldId}
        className={clsx(baseClassName, className)}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...inputProps}
      />
    ),
  });
}

export default TextInput;
