import { RootState } from "@/state/store";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";

export default function LeaderBoard(props: any) {
  const leaderboard = useSelector(
    (state: RootState) => state.player.leaderboard,
  );
  const { gameCode, quizQuestions } = props;
  const socket = props.socket;
  const router = useRouter();

  function handleEnd() {
    socket.emit("end-game-session", gameCode);
    router.push(`/admin/quiz/${quizQuestions?.id}`);
  }

  const firstThree = leaderboard?.slice(0, 3);
  const leaderboardRest = leaderboard?.slice(3);

  return (
    <>
      <div className="flex flex-col h-full w-full px-4 pt-6 text-dark dark:text-white">
        <p className="text-2xl font-black">Thank you for joining!</p>
        <div className="absolute top-2 right-10">
          <button
            className="px-3 py-2 bg-red-light rounded text-sm text-white font-black"
            onClick={handleEnd}
          >
            End Quiz
          </button>
        </div>
        <div className="w-[95vw] my-3 flex flex-col md:flex-row md:justify-between items-center">
          {firstThree?.length > 0
            ? firstThree.map((lead, index) => {
                return (
                  <div
                    key={index}
                    className={`flex md:flex-col md:justify-center items-center w-full md:w-[25vw] p-2 md:p-4 my-2 rounded-lg border-2 [&>*]:my-1 ${index == 0 ? "md:order-2 order-0 border-yellow-500 " : index == 1 ? "md:order-1 order-0 border-gray" : index == 2 ? "md:order-3 order-0 border-[#ec7070e8]" : ""}`}
                  >
                    {index == 0 ? (
                      <span className="text-xl md:text-3xl overflow-hidden text-[#F2AB53]">
                        1
                        <sup className="bg-gradient-to-b from-[#FFFF00] to-[#FFA800] text-transparent bg-clip-text">
                          st
                        </sup>
                      </span>
                    ) : index == 1 ? (
                      <span className="text-xl md:text-3xl overflow-hidden bg-gradient-to-b from-[#27272A] to-[#A6A6A6] text-transparent bg-clip-text">
                        2
                        <sup className="bg-gradient-to-b from-[#27272A] to-[#A6A6A6] text-transparent bg-clip-text">
                          nd
                        </sup>
                      </span>
                    ) : index == 2 ? (
                      <span className="text-xl md:text-3xl overflow-hidden bg-gradient-to-b from-[#EC7070F0] to-[#6D1E1EE5] text-transparent bg-clip-text">
                        3
                        <sup className="bg-gradient-to-b from-[#EC7070F0] to-[#6D1E1EE5] text-transparent bg-clip-text">
                          rd
                        </sup>
                      </span>
                    ) : (
                      `#${index + 1}`
                    )}
                    <div className="flex flex-row items-center gap-x-2 ml-3">
                      <Image
                        src={
                          lead.Player.profilePic ||
                          "/images/avatar-1577909_1280.webp"
                        }
                        className="w-12 h-12 rounded-full"
                        width={50}
                        height={50}
                        alt="profile pic"
                      />
                      <p className="text-base md:text-xl font-black break-words md:w-fit w-[40%]">
                        {lead.Player.name}
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
        <div className="flex flex-col items-center gap-4 my-3 py-3 px-2 w-[95vw] max-h-[35vh] overflow-y-auto rounded-2xl">
          {leaderboardRest?.length > 0
            ? leaderboardRest.map((lead, index) => {
                return (
                  <div
                    key={index}
                    className="flex items-center w-full py-2 px-6 bg-white rounded-lg"
                  >
                    <span className="text-3xl mr-3">{index + 4}</span>
                    <div className="flex flex-row items-center gap-x-2 z-20">
                      <Image
                        src={
                          lead.Player.profilePic ||
                          "/images/avatar-1577909_1280.webp"
                        }
                        className="w-12 h-12 rounded-full"
                        width={50}
                        height={50}
                        alt="profile pic"
                      />
                      <p>{lead.Player.name}</p>
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
