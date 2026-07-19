"use client";

import { useRouter } from "next/navigation";
import LeaderboardView from "@/components/Admin/LeaderboardView";

export default function QuizLeaderboardClient({ roomId }: { roomId: string }) {
  const router = useRouter();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <LeaderboardView
        roomId={roomId}
        onBack={() => router.back()}
        backLabel="Back"
      />
    </div>
  );
}
