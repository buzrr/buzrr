"use client";
import createPlayer from "@/actions/CreatePlayerAction";
import SubmitButton from "@/components/SubmitButton";
import SelectProfile from "@/components/Player/selectProfile";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from "react";

const CreatePlayerForm = (props: {
  data: {
    name: string;
    err: boolean;
    image: string;
  };
  setData: (data: any) => void;
}) => {
  const router = useRouter();

  async function clientAction(formData: FormData) {
    const result = await createPlayer(formData);
    if (result?.error) {
      const errorMsg = result.error || "Something went wrong";
      toast.error(errorMsg);
    } else {
      router.push(`/player/joinRoom/${result.playerId}`);
    }
  }

  useEffect(() => {
    const rightName = /^[a-z,0-9,.'-]{1,20}$/i;
    if (props.data.name && !rightName.test(props.data.name))
      props.setData({
        ...props.data,
        err: true,
      });
    else
      props.setData({
        ...props.data,
        err: false,
      });
  }, [props.data.name]);

  return (
    <form className="flex flex-col w-[90%] m-4" action={clientAction}>
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
        value={props.data.name}
        onChange={(e) =>
          props.setData({
            ...props.data,
            name: e.target.value,
          })
        }
      />
      <span
        className={` ${props.data.err ? "" : "invisible"} text-red-500 px-2 text-xs`}
      >
        Name must be alphanumeric with a max of 20 characters
      </span>
      <div className="w-full md:w-[40%] mt-10">
        <SubmitButton style="game" error={props.data.err} />
      </div>
    </form>
  );
};

export default CreatePlayerForm;
