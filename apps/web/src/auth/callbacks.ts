import type { NextAuthConfig } from "next-auth";

export const callbacks: NextAuthConfig["callbacks"] = {
  session({ session, user }) {
    if (session.user && user) {
      session.user.id = user.id;
    }
    return session;
  },
};
