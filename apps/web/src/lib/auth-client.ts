"use client";
import { createAuthClient } from "better-auth/react";

// Better Auth refetches the session on every tab focus by default — each one a
// web function call. Hosts flip tabs constantly mid-game, and sign-in/out
// already update the session store directly, so focus refetches buy nothing.
export const authClient = createAuthClient({
  sessionOptions: { refetchOnWindowFocus: false },
});
