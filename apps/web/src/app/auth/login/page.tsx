import { Suspense } from "react";
import SplitWrapper from "@/components/Auth/SplitWrapper";
import LoginForm from "@/components/Auth/LoginForm";
import { getAuthMethods } from "@/lib/auth-methods";

// Sign-in methods come from runtime env, so a self-hosted image built once
// can be configured per install.
export const dynamic = "force-dynamic";

const LoginPage = () => {
  return (
    <>
      <SplitWrapper
        sideImage="/images/login.svg"
        sideImageDark="/images/login-dark.svg"
      >
        <div className="dark:text-white bg-white dark:bg-dark rounded-2xl p-2 px-6 max-w-[90%] lg:max-w-[30%]">
          <h1 className="text-3xl font-black py-2">Login</h1>
          <p className="">
            Dive back into your learning journey by exploring our latest
            quizzes. Let&apos;s pick up where you left off.
          </p>
          <Suspense>
            <LoginForm methods={getAuthMethods()} />
          </Suspense>
        </div>
      </SplitWrapper>
    </>
  );
};

export default LoginPage;
