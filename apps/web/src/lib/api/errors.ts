import axios from "axios";

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
