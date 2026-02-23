"use client";

/**
 * Isolated chart component so it can be dynamic-imported (ssr: false).
 * Keeps @mui/x-charts out of the main admin bundle until the result screen is shown.
 */
import { BarPlot, ChartContainer } from "@mui/x-charts";
import { useEffect } from "react";
import { RxCross2 } from "react-icons/rx";
import { TiTick } from "react-icons/ti";
import type { Option } from "@/types/db";

export default function QuesResultChart(params: { result: number[]; options: Option[] }) {
  const uData = params?.result ? params?.result : [0, 0, 0, 0];
  const xLabels = ["Page A", "Page B", "Page C", "Page D"];

  useEffect(() => {
    const barsList = typeof document !== "undefined" ? document.getElementsByClassName("MuiBarElement-root") : [];
    if (barsList.length >= 4) {
      for (let i = 0; i < 4; i++) {
        (barsList[i] as HTMLElement).style.fill = "url(#gradient)";
        (barsList[i] as HTMLElement).style.borderRadius = "15px 0";
      }
    }
  }, [params.options, params.result]);

  return (
    <>
      <svg width="0" height="0">
        <defs>
          <linearGradient id="gradient" gradientTransform="rotate(90)">
            <stop offset="0%" stopColor="#7D49F8" />
            <stop offset="100%" stopColor="#A589FC" />
          </linearGradient>
        </defs>
      </svg>
      <div className="overflow-hidden flex flex-col items-center ">
        <div className="relative top-[74px] z-10 w-fit">
          <ChartContainer
            width={550}
            height={300}
            series={[{ data: uData, label: "", type: "bar" }]}
            xAxis={[{ scaleType: "band", data: xLabels }]}
          >
            <BarPlot />
          </ChartContainer>
        </div>

        <div className="flex flex-row justify-around w-[450px] text-lg relative z-20 ">
          {params.result.length > 0 &&
            params.result.map((opt: number, index: number) => {
              const isCorrect = params.options[index]?.isCorrect === true;
              return (
                <div className="flex flex-col" key={index}>
                  <p className="flex flex-row items-center justify-center w-full">
                    {opt}
                    {isCorrect ? (
                      <TiTick
                        size={20}
                        color="#000"
                        className="text-dark dark:text-white font-extrabold ml-2"
                      />
                    ) : (
                      <RxCross2
                        size={20}
                        color="#000"
                        className="text-white font-extrabold ml-2"
                      />
                    )}
                  </p>
                  <div key={index} className="w-20 border-t">
                    <p className="text-sm dark:text-white font-semibold w-full text-center">
                      {index}.{" "}
                      {params.options[index]?.title.length && params.options[index].title.length > 15
                        ? `${params.options[index].title.slice(0, 15)}...`
                        : params.options[index]?.title}{" "}
                      option
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
