import addBuzrr from "../../../actions/AddBuzrrAction";
import SubmitButton from "../../SubmitButton";
import { InputField } from "@buzrr/ui";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";

const CreateBuzrrForm = (params: { setTitle: (title: string) => void }) => {
  const router = useRouter();
  async function clientAction(formData: FormData) {
    const result = await addBuzrr(formData);
    if (result?.error) {
      const errorMsg = result.error || "Something went wrong";
      toast.error(errorMsg);
    } else {
      router.push(`/admin/quiz/${result.quizId}`);
    }
  }

  return (
    <form action={clientAction} className="flex flex-col w-full md:w-4/5 mt-8">
      <InputField
        type="text"
        name="title"
        placeholder="Enter quiz title"
        className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
        required
        autoComplete="off"
        onTitleChange={params.setTitle}
        label="Quiz title"
      />

      <InputField
        type="text"
        name="description"
        placeholder="Description"
        autoComplete="off"
        className="text-dark dark:text-white dark:bg-dark mt-1 border rounded-xl"
        textarea={true}
        label="Description (Optional)"
      />
      <SubmitButton />
    </form>
  );
};

export default CreateBuzrrForm;
