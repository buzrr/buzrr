import clsx from "clsx";
import { DEFAULT_AVATAR } from "@/constants";
import Image from "next/image";
import { useAppSelector } from "@/state/hooks";

export default function LeaderBoard() {
  const leaderboard = useAppSelector((state) => state.game.leaderboard);

  const firstThree = leaderboard.slice(0, 3);
  const leaderboardRest = leaderboard.slice(3);

  return (
    <>
      <div className="flex flex-col h-full w-full px-4 pt-6 text-dark dark:text-white">
        <p className="text-2xl font-black">Thank you for joining!</p>
        <div className="w-[95vw] my-3 flex flex-col md:flex-row md:justify-between items-center">
          {firstThree.length > 0
            ? firstThree.map((lead, index) => {
                return (
                  <div
                    key={lead.playerId}
                    className={clsx(
                      "flex md:flex-col md:justify-center items-center w-full md:w-[25vw] p-2 md:p-4 my-2 rounded-lg border-2 *:my-1",
                      index === 0 && "md:order-2 order-0 border-yellow-500",
                      index === 1 && "md:order-1 order-0 border-gray",
                      index === 2 && "md:order-3 order-0 border-[#ec7070e8]",
                    )}
                  >
                    {index == 0 ? (
                      <span className="text-xl md:text-3xl overflow-hidden text-[#F2AB53]">
                        1
                        <sup className="bg-linear-to-b from-[#FFFF00] to-[#FFA800] text-transparent bg-clip-text">
                          st
                        </sup>
                      </span>
                    ) : index == 1 ? (
                      <span className="text-xl md:text-3xl overflow-hidden bg-linear-to-b from-[#27272A] to-[#A6A6A6] text-transparent bg-clip-text">
                        2
                        <sup className="bg-linear-to-b from-[#27272A] to-[#A6A6A6] text-transparent bg-clip-text">
                          nd
                        </sup>
                      </span>
                    ) : index == 2 ? (
                      <span className="text-xl md:text-3xl overflow-hidden bg-linear-to-b from-[#EC7070F0] to-[#6D1E1EE5] text-transparent bg-clip-text">
                        3
                        <sup className="bg-linear-to-b from-[#EC7070F0] to-[#6D1E1EE5] text-transparent bg-clip-text">
                          rd
                        </sup>
                      </span>
                    ) : (
                      `#${index + 1}`
                    )}
                    <div className="flex flex-row items-center gap-x-2 ml-3">
                      <Image
                        src={lead.profilePic || DEFAULT_AVATAR}
                        className="w-12 h-12 rounded-full"
                        width={50}
                        height={50}
                        alt="profile pic"
                      />
                      <p className="text-base md:text-xl font-black wrap-break-word md:w-fit w-[40%]">
                        {lead.name}
                      </p>
                    </div>
                    <p className="text-xs md:text-sm text-off-dark dark:text-off-white ml-auto md:ml-0">
                      Total Points: {lead.score}
                    </p>
                  </div>
                );
              })
            : ""}
        </div>
        <div className="flex flex-col items-center gap-4 my-3 py-3 px-2 w-[95vw] max-h-[35dvh] overflow-y-auto rounded-2xl">
          {leaderboardRest.length > 0
            ? leaderboardRest.map((lead) => {
                return (
                  <div
                    key={lead.playerId}
                    className="flex items-center w-full py-2 px-6 bg-white rounded-lg"
                  >
                    <span className="text-3xl mr-3">{lead.rank}</span>
                    <div className="flex flex-row items-center gap-x-2 z-20">
                      <Image
                        src={lead.profilePic || DEFAULT_AVATAR}
                        className="w-12 h-12 rounded-full"
                        width={50}
                        height={50}
                        alt="profile pic"
                      />
                      <p>{lead.name}</p>
                    </div>
                    <p className="ml-auto">{lead.score}</p>
                  </div>
                );
              })
            : ""}
        </div>
      </div>
    </>
  );
}
