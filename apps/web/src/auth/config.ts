import type { NextAuthConfig } from "next-auth";
import { callbacks } from "./callbacks";
import { providers } from "./providers";

export const authConfig = {
  providers,
  callbacks,
} satisfies NextAuthConfig;
