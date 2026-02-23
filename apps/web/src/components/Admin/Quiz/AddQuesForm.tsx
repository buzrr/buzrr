"use client";

import SubmitButton from "../../SubmitButton";
import { InputField } from "@buzrr/ui";
import { FormLabel } from "@mui/material";
import { RadioField } from "@/components/RadioField";
import addQues from "@/actions/AddQuesAction";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { RxCross2 } from "react-icons/rx";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

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

const AddQuesForm = (props: { quizId: string; question?: Question }) => {
  const { question } = props;
  const [file, setFile] = useState<File | null>();
  const [fileLink, setFileLink] = useState(
    question?.media ? question.media : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function clientAction(formData: FormData) {
    const result = await addQues(formData);
    if (result?.error) {
      const errorMsg = result.error || "Something went wrong";
      toast.error(errorMsg);
    } else {
      toast.success("Successfully added");
    }
  }

  const options = question?.options;
  return (
    <form
      action={clientAction}
      className="flex flex-col justify-center mx-auto"
    >
      <input
        type="text"
        className="hidden"
        name="quiz_id"
        value={props.quizId}
      />
      <input
        type="text"
        className="hidden"
        name="ques_id"
        value={question?.id}
      />
      <InputField
        type="text"
        name="title"
        placeholder="Title"
        className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
        required
        autoComplete="off"
        label="Question"
        labelClass="text-lg"
        fieldValue={question?.title}
        maxLength={150}
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
        <input
          type="text"
          className="hidden"
          name="file_link"
          value={fileLink}
        />
        <input
          type="text"
          className="hidden"
          name="media_type"
          value={question?.mediaType ? question.mediaType : ""}
        />
      </div>
      <p className="text-xs mt-[-12px] text-dark dark:text-white mb-2">
        Choose any image or gif of size &lt; 10MB{" "}
      </p>

      {fileLink || file ? (
        <div className="relative">
          <Image
            src={previewUrl ?? fileLink}
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
      ) : (
        ""
      )}

      <FormLabel
        style={{ fontSize: "14px", marginBottom: "4px" }}
        className="text-sm dark:text-white text-dark mb-0"
      >
        Enter options
      </FormLabel>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-0">
        <div className="relative">
          <InputField
            type="text"
            name="option1"
            placeholder="Enter option 1"
            autoComplete="off"
            className="text-dark dark:text-white dark:bg-dark rounded-xl outline-none border w-full my-0 pr-4"
            style="question"
            required
            fieldValue={options && options[0]?.title}
          />
          <RadioField
            defaultvalue={options && options[0]?.isCorrect ? "a" : ""}
            val="a"
          />
        </div>
        <div className="relative">
          <InputField
            type="text"
            name="option2"
            placeholder="Enter option 2"
            autoComplete="off"
            className="text-dark dark:text-white dark:bg-dark rounded-xl outline-none my-0 border w-full pr-4"
            style="question"
            required
            fieldValue={options && options[1]?.title}
          />
          <RadioField
            defaultvalue={options && options[1]?.isCorrect ? "b" : ""}
            val="b"
          />
        </div>
        <div className="relative">
          <InputField
            type="text"
            name="option3"
            placeholder="Enter option 3"
            autoComplete="off"
            className="text-dark dark:text-white dark:bg-dark rounded-xl outline-none border my-0 w-full pr-4"
            style="question"
            required
            fieldValue={options && options[2]?.title}
          />
          <RadioField
            defaultvalue={options && options[2]?.isCorrect ? "c" : ""}
            val="c"
          />
        </div>
        <div className="relative">
          <InputField
            type="text"
            name="option4"
            placeholder="Enter option 4"
            autoComplete="off"
            className="text-dark dark:text-white dark:bg-dark rounded-xl outline-none border my-0 w-full pr-4"
            style="question"
            required
            fieldValue={options && options[3]?.title}
          />
          <RadioField
            defaultvalue={options && options[3]?.isCorrect ? "d" : ""}
            val="d"
          />
        </div>
      </div>
      <InputField
        type="number"
        name="time"
        placeholder="question time"
        className="text-dark dark:text-white my-2 rounded-xl border dark:bg-dark"
        required={false}
        autoComplete="off"
        label="Question Time (in seconds)"
        fieldValue={question?.timeOut ? question.timeOut.toString() : ""}
      />

      <div className="text-center mt-2">
        <SubmitButton />
      </div>
    </form>
  );
};

export default AddQuesForm;
