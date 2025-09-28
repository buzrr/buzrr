"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@/schemas";
import Link from "next/link";
import Image from "next/image";
import * as z from "zod";

const LoginForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  const onSubmit = (values: z.infer<typeof LoginSchema>) => {
    console.log(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        id="email"
        className="dark:text-white bg-white dark:bg-dark border border-gray p-2 w-full my-2 rounded-xl"
        {...register("email")}
        placeholder="Enter Email"
        required
      />
      <br />
      {errors.email?.message && (
        <p className="text-xs">{errors.email?.message as string}</p>
      )}
      <input
        id="password"
        className="dark:text-white bg-white dark:bg-dark border border-gray p-2 w-full my-2 rounded-xl"
        type="password"
        {...register("password")}
        placeholder="Enter Password"
        required
      />
      <br />
      {errors.password?.message && <p>{errors.password?.message as string}</p>}
      <Link
        href="#"
        className="w-fit float-right text-sm text-lprimary dark:text-dprimary"
      >
        Forgot Password?
      </Link>
      <input
        className="p-2 my-4 w-full bg-lprimary dark:bg-dprimary hover:cursor-pointer text-white font-bold rounded-xl"
        type="submit"
        value="Continue"
      />
      <button
        className="p-2 w-full border-2 flex items-center justify-center border-lprimary dark:border-dprimary hover:cursor-pointer text-lprimary dark:text-dprimary font-bold rounded-xl"
        onClick={(e) => {
          e.preventDefault();
          console.log("login");
        }}
      >
        <Image
          src="/images/google-icon.svg"
          className="mr-2 inline"
          width={20}
          height={20}
          alt="Google Logo"
        />
        Continue with Google
      </button>
    </form>
  );
};

export default LoginForm;
