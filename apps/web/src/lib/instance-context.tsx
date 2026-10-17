"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { InstanceConfig } from "./instance";

const DEFAULTS: InstanceConfig = {
  billing: false,
  privateBuzz: false,
  title: "",
  contactEmail: "",
};

const InstanceContext = createContext<InstanceConfig>(DEFAULTS);

/** Set once in the root layout from the server's environment. */
export function InstanceProvider({
  config,
  children,
}: {
  config: InstanceConfig;
  children: ReactNode;
}) {
  return (
    <InstanceContext.Provider value={config}>
      {children}
    </InstanceContext.Provider>
  );
}

/** The instance options (see lib/instance.ts) in client components. */
export const useInstance = () => useContext(InstanceContext);
