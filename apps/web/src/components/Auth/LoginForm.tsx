"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";
import type { AuthMethods } from "@/lib/auth-methods";

/** Only allow same-origin relative paths — never forward an external URL. */
function sanitizeCallbackURL(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/admin";
}

const inputClass =
  "w-full rounded-xl border border-lprimary/15 dark:border-white/10 bg-light-bg dark:bg-card-dark px-4 py-3 text-base outline-none focus:border-dprimary";

/**
 * Local accounts (AUTH_EMAIL_PASSWORD=ON) — the sign-in that needs nothing
 * outside the server, for self-hosted and offline installs.
 */
function EmailPasswordForm({
  callbackURL,
  allowSignUp,
}: {
  callbackURL: string;
  allowSignUp: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    const { error: authError } =
      mode === "signUp"
        ? await authClient.signUp.email({
            name: String(form.get("name") ?? ""),
            email,
            password,
            callbackURL,
          })
        : await authClient.signIn.email({ email, password, callbackURL });
    if (authError) {
      setError(authError.message ?? "Sign in failed. Please try again.");
      setPending(false);
      return;
    }
    router.push(callbackURL);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
      {mode === "signUp" && (
        <input
          name="name"
          required
          maxLength={60}
          autoComplete="name"
          placeholder="Your name"
          className={inputClass}
        />
      )}
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete={mode === "signUp" ? "new-password" : "current-password"}
        placeholder="Password"
        className={inputClass}
      />
      {error && (
        <p className="text-sm text-red-light dark:text-red-dark">{error}</p>
      )}
      <Button type="submit" fullWidth disabled={pending}>
        {pending
          ? "Please wait…"
          : mode === "signUp"
            ? "Create account"
            : "Sign in"}
      </Button>
      {allowSignUp && (
        <button
          type="button"
          className="text-sm text-lprimary dark:text-dprimary cursor-pointer"
          onClick={() => {
            setError(null);
            setMode(mode === "signIn" ? "signUp" : "signIn");
          }}
        >
          {mode === "signIn"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      )}
    </form>
  );
}

const LoginForm = ({ methods }: { methods: AuthMethods }) => {
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
    // Google-only installs go straight to Google. Skip that when returning
    // from a failed/cancelled OAuth attempt, otherwise the page would bounce
    // straight back to Google in a loop.
    if (!methods.google || methods.emailPassword) return;
    if (autoTriggered.current || oauthError) return;
    autoTriggered.current = true;
    void signInWithGoogle();
  }, [methods.google, methods.emailPassword, oauthError, signInWithGoogle]);

  return (
    <div className="py-4 flex flex-col gap-4">
      {oauthError && (
        <p className="text-sm text-red-light dark:text-red-dark my-2">
          Sign in was cancelled or failed. Please try again.
        </p>
      )}
      {methods.emailPassword && (
        <EmailPasswordForm
          callbackURL={callbackURL}
          allowSignUp={methods.emailSignUp}
        />
      )}
      {methods.google && (
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
      )}
    </div>
  );
};

export default LoginForm;
