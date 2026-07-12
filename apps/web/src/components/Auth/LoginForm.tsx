"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

const LoginForm = () => {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const autoTriggered = useRef(false);
  const [redirecting, setRedirecting] = useState(false);

  const signInWithGoogle = async () => {
    setRedirecting(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/admin",
      });
    } catch {
      setRedirecting(false);
    }
  };

  useEffect(() => {
    // Skip auto-trigger when returning from a failed/cancelled OAuth attempt,
    // otherwise the page would bounce straight back to Google in a loop.
    if (autoTriggered.current || oauthError) return;
    autoTriggered.current = true;
    void signInWithGoogle();
  }, [oauthError]);

  return (
    <div className="py-4">
      {oauthError && (
        <p className="text-sm text-red-light dark:text-red-dark my-2">
          Sign in was cancelled or failed. Please try again.
        </p>
      )}
      <Button
        variant="outline"
        fullWidth
        disabled={redirecting}
        onClick={() => void signInWithGoogle()}
      >
        <Image
          src="/images/google-icon.svg"
          className="mr-2 inline"
          width={20}
          height={20}
          alt="Google Logo"
        />
        {redirecting ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
    </div>
  );
};

export default LoginForm;
