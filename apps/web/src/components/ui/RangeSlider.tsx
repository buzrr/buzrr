"use client";

export default function RangeSlider({
  min,
  max,
  value,
  onChange,
  ticks,
  label,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  ticks: string[];
  label: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-[22px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-lprimary [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.25)] [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-lprimary focus-visible:ring-4 focus-visible:ring-dprimary/30"
        style={{
          background: `linear-gradient(90deg, #a78bfa 0, #7c4ddb ${pct}%, rgba(124,92,246,0.15) ${pct}%)`,
        }}
      />
      <div
        className="-mt-1 flex justify-between text-[11.5px] font-medium text-[#8a8896] dark:text-[#71717a]"
        aria-hidden="true"
      >
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </>
  );
}
