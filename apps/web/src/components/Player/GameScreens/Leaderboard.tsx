import React from "react";

interface Stats {
  position: number | null;
  score: number;
}

const Leaderboard = (params: Stats) => {
  return (
    <>
      <div className="p-2 my-4 bg-slate-200 text-blue-600 text-lg text-center rounded-md">
        Congratulations!
        <br /> You have completed the quiz
      </div>
      <div className="p-2 my-2 bg-black opacity-70 rounded-md text-2xl text-slate-200">
        Position: {params.position ? params.position : "NA"}
      </div>
      <div className="p-2 my-2 bg-black opacity-70 rounded-md text-xl text-slate-200">
        Score: {params.score}
      </div>
    </>
  );
};

export default Leaderboard;
