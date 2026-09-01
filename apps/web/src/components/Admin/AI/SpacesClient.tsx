"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import {
  LuEllipsisVertical,
  LuFileText,
  LuPlus,
  LuSparkles,
} from "react-icons/lu";
import { toast } from "react-toastify";
import CreateSpaceModal from "./CreateSpaceModal";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import Skeleton from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDeleteSpaceMutation, useSpacesQuery } from "@/lib/modules/ai/hooks";

const CARD =
  "border border-[#c2b4fe] dark:border-transparent w-full bg-card-light hover:bg-cardhover-light dark:bg-card-dark hover:dark:bg-cardhover-dark transition-all duration-300 ease-in-out text-dark dark:text-white rounded-lg";

export default function SpacesClient() {
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { data: spaces, isPending, isError } = useSpacesQuery();
  const remove = useDeleteSpaceMutation();

  return (
    <div className="p-4 md:p-6 w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="md:hidden inline">
            <NavbarToggle />
          </span>
          <h1 className="text-2xl font-black text-dark dark:text-white">
            AI Spaces
          </h1>
        </div>
      </div>
      <p className="mt-1 text-sm text-off-dark dark:text-off-white">
        Upload your own material, then generate quiz questions grounded in it.
      </p>

      <div className="mt-4 bg-white dark:bg-dark rounded-2xl p-4 md:p-6 min-h-[60vh]">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                className="h-40 w-full md:w-52 rounded-lg bg-card-light dark:bg-card-dark"
              />
            ))}
          </div>
        ) : isError || !spaces ? (
          <p className="text-dark dark:text-white text-sm">
            Could not load your AI spaces. Check your connection and that the
            Buzrr-AI service is running.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={clsx(
                CARD,
                "flex flex-col justify-center items-center gap-2 p-3 h-40 md:w-52 md:h-44 cursor-pointer",
              )}
            >
              <LuPlus size={26} className="text-lprimary dark:text-dprimary" />
              <span className="text-sm font-bold">New knowledge space</span>
              <span className="text-xs text-off-dark dark:text-off-white text-center">
                Start from your documents
              </span>
            </button>

            {spaces.map((space) => (
              <div
                key={space.id}
                className={clsx(CARD, "relative h-40 md:w-52 md:h-44")}
              >
                <Link
                  href={`/admin/ai/${space.id}`}
                  className="flex h-full flex-col p-3"
                >
                  <LuSparkles
                    size={20}
                    className="text-lprimary dark:text-dprimary"
                    aria-hidden
                  />
                  <span className="mt-2 text-sm font-bold line-clamp-2">
                    {space.name}
                  </span>
                  <span className="mt-1 text-xs text-off-dark dark:text-off-white line-clamp-2">
                    {space.description || "No description"}
                  </span>
                  <span className="mt-auto flex items-center gap-1.5 text-xs text-off-dark dark:text-off-white">
                    <LuFileText size={13} aria-hidden />
                    {space.documentCount} doc
                    {space.documentCount === 1 ? "" : "s"}
                    {space.documentCount > space.readyCount && (
                      <Badge tone="warning" className="ml-1">
                        {space.documentCount - space.readyCount} pending
                      </Badge>
                    )}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${space.name}`}
                  onClick={() => setPendingDelete(space.id)}
                  className="absolute top-2 right-2 p-1 rounded-md text-off-dark dark:text-off-white hover:bg-white dark:hover:bg-dark"
                >
                  <LuEllipsisVertical size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {spaces && spaces.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title="No spaces yet"
              hint="A knowledge space is where your documents live. Create one to get started."
            />
          </div>
        )}
      </div>

      <CreateSpaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ConfirmationModal
        open={pendingDelete !== null}
        setOpen={(next) => {
          if (!next) setPendingDelete(null);
        }}
        desc="Delete this space? Its documents and everything indexed from them will be removed. Quizzes you already exported are not affected."
        confirmLabel="Delete"
        confirming={remove.isPending}
        confirmingLabel="Deleting…"
        onClick={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete, {
            onSuccess: () => toast.success("Space deleted"),
            onError: (error) => toast.error(getApiErrorMessage(error)),
          });
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
