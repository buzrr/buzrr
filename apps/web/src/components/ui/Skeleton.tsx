import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export default function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`.trim()}
      {...props}
    />
  );
}
