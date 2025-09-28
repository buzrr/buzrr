"use client";
import { Provider } from "react-redux";
import { store, persistor } from "../state/store";
import React from "react";
import { PersistGate } from "redux-persist/integration/react";

export default function ReduxProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
