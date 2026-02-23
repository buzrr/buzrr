"use client";
import createPlayer from "@/actions/CreatePlayerAction";
import SubmitButton from "@/components/SubmitButton";
import SelectProfile from "@/components/Player/selectProfile";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";

const CreatePlayerForm = (props: {
  data: {
    name: string;
    image: string;
  };
  setData: (data: { name: string; image: string }) => void;
}) => {
  const router = useRouter();

  async function clientAction(formData: FormData) {
    const result = await createPlayer(formData);
    if (result?.error) {
      toast.error(result.error || "Something went wrong");
    } else {
      router.push(`/player/joinRoom/${result.playerId}`);
    }
  }

  const handleNameChange = (value: string) => {
    // Allow only letters, numbers, underscore
    const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "");

    // Restrict to 30 characters
    const trimmed = cleaned.slice(0, 30);

    props.setData({
      ...props.data,
      name: trimmed,
    });
  };

  return (
    <form className="flex flex-col" action={clientAction}>
      <h1 className="text-3xl md:text-5xl py-2 font-extrabold dark:text-white">
        Create a custom profile
      </h1>
      <h2 className="md:text-lg py-2 dark:text-white">Join a private quiz</h2>

      <SelectProfile {...props} />

      <input
        type="text"
        name="username"
        placeholder="Enter Display Name"
        className="w-full border-gray border focus:border-blue-600 rounded-lg outline-none md:w-4/5 text-dark dark:text-gray dark:bg-dark-bg my-2 px-4 py-3"
        required
        autoComplete="off"
        maxLength={30}
        value={props.data.name}
        onChange={(e) => handleNameChange(e.target.value)}
      />

      <div className="w-full md:w-[40%] mt-10">
        <SubmitButton style="game" />
      </div>
    </form>
  );
};

export default CreatePlayerForm;
