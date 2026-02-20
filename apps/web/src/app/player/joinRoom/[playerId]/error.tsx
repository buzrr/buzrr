"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ErrorBoundary({ error }: { error: Error }) {
  const router = useRouter();
  useEffect(() => {
    localStorage?.removeItem("playerId");
    router.push("/player");
  }, [router]);
  return (
    <div className="h-screen w-screen flex justify-center items-center">
      <div className="p-2 mx-auto w-fit bg-slate-200 rounded-md text-sm">
        {error.message}
      </div>
    </div>
  );
}
