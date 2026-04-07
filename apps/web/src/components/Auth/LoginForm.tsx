"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@/schemas";
import Link from "next/link";
import Image from "next/image";
import * as z from "zod";
import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";

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

  const onSubmit = (_values: z.infer<typeof LoginSchema>) => {
    // TODO: implement credential-based login
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="email" className="sr-only">Email</label>
      <TextInput
        id="email"
        {...register("email")}
        placeholder="Enter Email"
        required
        containerClassName="my-2"
        autoComplete="email"
        error={errors.email?.message as string | undefined}
      />
      <label htmlFor="password" className="sr-only">Password</label>
      <TextInput
        id="password"
        type="password"
        {...register("password")}
        placeholder="Enter Password"
        required
        containerClassName="my-2"
        autoComplete="current-password"
        error={errors.password?.message as string | undefined}
      />
      <Link
        href="#"
        className="w-fit float-right text-sm text-lprimary dark:text-dprimary"
      >
        Forgot Password?
      </Link>
      <Button className="my-4" fullWidth type="submit">
        Continue
      </Button>
      <Button
        variant="outline"
        fullWidth
        onClick={(e) => {
          e.preventDefault();
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
      </Button>
    </form>
  );
};

export default LoginForm;
