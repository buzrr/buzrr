import { auth } from "@/utils/auth";
import { prisma } from "@buzrr/prisma";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function QuizLeaderboard({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");

  const leaderboard = await prisma.gameLeaderboard.findMany({
    where: {
      gameSessionId: roomId,
    },
    include: {
      Player: true,
    },
    orderBy: {
      score: "desc",
    },
  });

  return (
    <>
      <div className="flex flex-col items-center m-auto w-full px-4 my-8 gap-4 overflow-x-visible">
        <p className="w-full py-2 px-3 text-2xl text-center bg-white text-slate-900 font-semibold rounded max-w-fit capitalize overflow-x-visible">
          Leaderboard
        </p>

        <div className="flex flex-col gap-4 my-6 overflow-x-visible">
          {leaderboard?.length > 0
            ? leaderboard.map((lead, index) => {
                return (
                  <div
                    key={index}
                    className="shadow-xl flex justify-between px-4 py-2 flex-row w-[60vw] items-center z-10 bg-white text-black"
                  >
                    {index == 0 ? (
                      <span className="text-3xl overflow-hidden">🥇</span>
                    ) : index == 1 ? (
                      <span className="text-3xl overflow-hidden">🥈</span>
                    ) : index == 2 ? (
                      <span className="text-3xl overflow-hidden">🥉</span>
                    ) : (
                      `#${index + 1}`
                    )}
                    <div className="flex flex-row items-center gap-x-2 z-20">
                      <Image
                        src={
                          lead.Player.profilePic || "/avatar-1577909_1280.webp"
                        }
                        className="w-12 h-12 rounded-full"
                        width={50}
                        height={50}
                        alt="profile pic"
                      />
                      <p>{lead.Player.name}</p>
                    </div>
                    <p>{lead.score}</p>
                  </div>
                );
              })
            : null}
        </div>
      </div>
    </>
  );
}
