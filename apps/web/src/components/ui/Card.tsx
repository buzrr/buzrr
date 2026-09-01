"use client";

import clsx from "clsx";

/**
 * The card frame used across the app, promoted out of the local `SettingsCard`
 * in `Admin/Settings/SettingsClient.tsx` so the AI section doesn't fork it again.
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={clsx(
        "bg-white dark:bg-card-dark rounded-xl p-4 md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-black text-dark dark:text-white truncate">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-off-dark dark:text-off-white mt-1">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-gray border-dashed rounded-lg p-6 text-center text-dark dark:text-white">
      <p className="text-lg font-black">{title}</p>
      {hint && (
        <p className="text-sm mt-2 text-off-dark dark:text-off-white">{hint}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
