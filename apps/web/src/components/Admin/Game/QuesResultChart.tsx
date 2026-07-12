"use client";

/**
 * Isolated chart component so it can be dynamic-imported (ssr: false).
 * Keeps @mui/x-charts out of the main admin bundle until the result screen is shown.
 */
import { BarPlot, ChartContainer } from "@mui/x-charts";
import { useEffect, useId, useRef, useState } from "react";
import { RxCross2 } from "react-icons/rx";
import { TiTick } from "react-icons/ti";

const MAX_WIDTH = 550;

export default function QuesResultChart(params: {
  result: number[];
  options: { id: string; title: string }[];
  correctOptionIds: string[];
}) {
  const uData = params?.result ? params?.result : [0, 0, 0, 0];
  const xLabels = ["Page A", "Page B", "Page C", "Page D"];
  const gradientId = `chart-gradient-${useId()}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(MAX_WIDTH);

  // Track the container so the chart never overflows small screens.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.min(Math.floor(w), MAX_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <svg width="0" height="0">
        <defs>
          <linearGradient id={gradientId} gradientTransform="rotate(90)">
            <stop offset="0%" stopColor="#7D49F8" />
            <stop offset="100%" stopColor="#A589FC" />
          </linearGradient>
        </defs>
      </svg>
      <div
        ref={containerRef}
        className="w-full overflow-hidden flex flex-col items-center"
      >
        <div className="relative top-[74px] z-10 w-fit">
          <ChartContainer
            width={width}
            height={300}
            series={[
              {
                data: uData,
                label: "",
                type: "bar",
                color: `url(#${gradientId})`,
              },
            ]}
            xAxis={[{ scaleType: "band", data: xLabels }]}
          >
            <BarPlot borderRadius={15} />
          </ChartContainer>
        </div>

        <div
          className="flex flex-row justify-around text-lg relative z-20"
          style={{ width: Math.min(width, 450) }}
        >
          {params.result.length > 0 &&
            params.result.map((opt: number, index: number) => {
              const optionId = params.options[index]?.id;
              const isCorrect =
                optionId !== undefined &&
                params.correctOptionIds.includes(optionId);
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
