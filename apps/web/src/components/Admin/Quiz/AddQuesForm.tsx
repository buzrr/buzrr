"use client";

import SubmitButton from "../../SubmitButton";
import { InputField } from "@/components/InputField";
import { DEFAULT_QUESTION_TIMEOUT } from "@/constants";
import { FormLabel } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { RxCross2 } from "react-icons/rx";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/errors";
import { addQuestionSchema } from "@/lib/modules/forms/schemas";
import { useUpsertQuestionMutation } from "@/lib/modules/questions/hooks";

interface Option {
  id?: string;
  title?: string;
  isCorrect?: boolean;
  questionId?: string;
  createdAt?: Date;
}

interface Question {
  id: string;
  title?: string;
  quizId?: string;
  createdAt?: Date;
  timeOut?: number;
  media?: string | null;
  mediaType?: string | null;
  options?: Option[];
}

type FormValues = z.infer<typeof addQuestionSchema>;

function defaultCorrectLetter(options?: Option[]): "a" | "b" | "c" | "d" {
  if (!options?.length) return "a";
  const idx = options.findIndex((o) => o.isCorrect);
  const letters: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
  return letters[idx] ?? "a";
}

const AddQuesForm = (props: { quizId: string; question?: Question }) => {
  const { question } = props;
  const options = question?.options;
  const mutation = useUpsertQuestionMutation(props.quizId);
  const [file, setFile] = useState<File | null>();
  const [fileLink, setFileLink] = useState(
    question?.media ? question.media : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(addQuestionSchema) as Resolver<FormValues>,
    defaultValues: {
      title: question?.title ?? "",
      option1: options?.[0]?.title ?? "",
      option2: options?.[1]?.title ?? "",
      option3: options?.[2]?.title ?? "",
      option4: options?.[3]?.title ?? "",
      choose_option: defaultCorrectLetter(options),
      time: question?.timeOut ?? DEFAULT_QUESTION_TIMEOUT,
    },
  });

  useEffect(() => {
    reset({
      title: question?.title ?? "",
      option1: options?.[0]?.title ?? "",
      option2: options?.[1]?.title ?? "",
      option3: options?.[2]?.title ?? "",
      option4: options?.[3]?.title ?? "",
      choose_option: defaultCorrectLetter(options),
      time: question?.timeOut ?? DEFAULT_QUESTION_TIMEOUT,
    });
    setFile(null);
    setFileLink(question?.media ? question.media : "");
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [question, options, reset]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  }

  function deleteFile() {
    setFile(null);
    setPreviewUrl(null);
    setFileLink("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const onSubmit = handleSubmit((data) => {
    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("option1", data.option1);
    fd.append("option2", data.option2);
    fd.append("option3", data.option3);
    fd.append("option4", data.option4);
    fd.append("choose_option", data.choose_option);
    fd.append(
      "time",
      String(
        data.time !== undefined && !Number.isNaN(data.time)
          ? data.time
          : DEFAULT_QUESTION_TIMEOUT,
      ),
    );
    fd.append("file_link", fileLink);
    fd.append("media_type", file ? "" : (question?.mediaType ?? ""));
    if (question?.id) fd.append("ques_id", question.id);
    if (file) fd.append("file", file);

    mutation.mutate(fd, {
      onSuccess: () => {
        toast.success("Successfully added");
        if (!question?.id) {
          reset({
            title: "",
            option1: "",
            option2: "",
            option3: "",
            option4: "",
            choose_option: "a",
            time: DEFAULT_QUESTION_TIMEOUT,
          });
          deleteFile();
        }
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col justify-center mx-auto"
    >
      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            type="text"
            name="title"
            placeholder="Title"
            className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
            required
            autoComplete="off"
            label="Question"
            labelClass="text-lg"
            fieldValue={field.value}
            onTitleChange={field.onChange}
            maxLength={150}
            error={!!fieldState.error}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <div className="flex flex-col mb-3">
        <label className="text-sm text-dark dark:text-white mb-0">
          Upload Image / Video / Audio
        </label>
        <input
          type="file"
          accept="image/*"
          className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border border-dark dark:border-white focus:bg-[#EEEEF0] focus:outline-none focus:dark:bg-[#27272A] px-4 py-2 "
          name="file"
          placeholder="Select file"
          autoComplete="off"
          ref={fileInputRef}
          onChange={handleFile}
        />
      </div>
      <p className="text-xs mt-[-12px] text-dark dark:text-white mb-2">
        Choose any image or gif of size &lt; 10MB{" "}
      </p>

      {(previewUrl || fileLink) && (
        <div className="relative">
          <Image
            src={previewUrl || fileLink}
            alt="media"
            width={160}
            height={80}
            className="w-40 h-20 mb-3 mt-1"
          />
          <RxCross2
            size={24}
            className="text-red-500 absolute top-0 left-36 font-bold cursor-pointer"
            onClick={deleteFile}
          />
        </div>
      )}

      <FormLabel
        style={{ fontSize: "14px", marginBottom: "4px" }}
        className="text-sm dark:text-white text-dark mb-0"
      >
        Enter options
      </FormLabel>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-0">
        {(
          [
            ["option1", "a"],
            ["option2", "b"],
            ["option3", "c"],
            ["option4", "d"],
          ] as const
        ).map(([name, letter], i) => (
          <div key={name} className="relative">
            <Controller
              name={name}
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  type="text"
                  name={name}
                  placeholder={`Enter option ${i + 1}`}
                  autoComplete="off"
                  className="text-dark dark:text-white dark:bg-dark rounded-xl outline-none border w-full my-0 pr-4"
                  style="question"
                  required
                  fieldValue={field.value}
                  onTitleChange={field.onChange}
                  error={!!fieldState.error}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="choose_option"
              control={control}
              render={({ field }) => (
                <input
                  type="radio"
                  className="absolute top-[26px] right-2"
                  value={letter}
                  checked={field.value === letter}
                  onChange={() => field.onChange(letter)}
                />
              )}
            />
          </div>
        ))}
      </div>
      <Controller
        name="time"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            type="number"
            name="time"
            placeholder="question time"
            className="text-dark dark:text-white my-2 rounded-xl border dark:bg-dark"
            required={false}
            autoComplete="off"
            label="Question Time (in seconds)"
            fieldValue={field.value?.toString() ?? ""}
            onTitleChange={(v) =>
              field.onChange(v === "" ? undefined : Number(v))
            }
            error={!!fieldState.error}
            errorMessage={fieldState.error?.message}
          />
        )}
      />

      <div className="text-center mt-2">
        <SubmitButton isPending={mutation.isPending} />
      </div>
    </form>
  );
};

export default AddQuesForm;
