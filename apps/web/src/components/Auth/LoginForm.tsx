"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

/** Only allow same-origin relative paths — never forward an external URL. */
function sanitizeCallbackURL(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/admin";
}

const LoginForm = () => {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const callbackURL = sanitizeCallbackURL(searchParams.get("callbackURL"));
  const autoTriggered = useRef(false);
  const [redirecting, setRedirecting] = useState(false);

  const signInWithGoogle = useCallback(async () => {
    setRedirecting(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } catch {
      setRedirecting(false);
    }
  }, [callbackURL]);

  useEffect(() => {
    // Skip auto-trigger when returning from a failed/cancelled OAuth attempt,
    // otherwise the page would bounce straight back to Google in a loop.
    if (autoTriggered.current || oauthError) return;
    autoTriggered.current = true;
    void signInWithGoogle();
  }, [oauthError, signInWithGoogle]);

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
