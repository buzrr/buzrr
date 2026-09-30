"use client";
import { Provider } from "react-redux";
import { usePathname } from "next/navigation";
import { store, persistor } from "../state/store";
import React from "react";
import { PersistGate } from "redux-persist/integration/react";
import { isPublicContentPath } from "@/lib/seo/public-routes";

export default function ReduxProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // `PersistGate` renders nothing until localStorage rehydrates — which never
  // happens on the server, so gated pages ship an empty <body>. Public content
  // pages only read the persisted theme, so they render straight away (with
  // the default theme until rehydration) and keep their server HTML. App
  // screens still wait for rehydration, exactly as before.
  if (isPublicContentPath(pathname)) {
    return (
      <Provider store={store}>
        <PersistGate persistor={persistor}>{() => children}</PersistGate>
      </Provider>
    );
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
