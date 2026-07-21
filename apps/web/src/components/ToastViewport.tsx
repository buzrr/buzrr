"use client";

import { ToastContainer, Zoom } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ToastViewport() {
  return (
    <ToastContainer
      position="top-center"
      transition={Zoom}
      limit={1}
      autoClose={2500}
      hideProgressBar
      newestOnTop
      closeButton={false}
      theme="dark"
      className="buzrr-toast-container"
      toastClassName="buzrr-toast"
    />
  );
}
