"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/types/db";

const RoleContext = createContext<Role>("user");

/** Current account's DB role, computed fresh per request in `admin/layout.tsx`. */
export function useCurrentRole(): Role {
  return useContext(RoleContext);
}

export default function SessionProvider({
  role,
  children,
}: {
  role?: Role;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider value={role ?? "user"}>
      {children}
    </RoleContext.Provider>
  );
}
