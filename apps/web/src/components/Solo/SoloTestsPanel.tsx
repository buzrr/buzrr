"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { Box, Modal } from "@mui/material";
import {
  LuChartBar,
  LuClipboardList,
  LuCopy,
  LuLock,
  LuLockOpen,
  LuTrash2,
  LuUser,
} from "react-icons/lu";
import type { SoloTestItem } from "@buzrr/contract";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import ModalCloseButton from "@/components/ModalCloseButton";
import ShareRoom from "@/components/ShareRoom";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/Game/GameUI";
import { getApiErrorMessage } from "@/lib/api/errors";
import { soloLink } from "@/lib/modules/solo/api";
import {
  useCreateSoloTestMutation,
  useDeleteSoloTestMutation,
  useSoloTestsQuery,
  useUpdateSoloTestMutation,
} from "@/lib/modules/solo/hooks";
import modalStyle from "@/utils/modalStyle";

const actionClass =
  "inline-flex items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-semibold cursor-pointer transition-colors hover:bg-lprimary/8 dark:hover:bg-white/5 disabled:opacity-50";

/**
 * "Play alone" on the quiz page: try the quiz alone, or make a test — a
 * link players open and play on their own — and see how it went.
 */
export default function SoloTestsPanel({
  quizId,
  questionCount,
  onShowReport,
}: {
  quizId: string;
  questionCount: number;
  onShowReport?: (testId: string) => void;
}) {
  const router = useRouter();
  const tests = useSoloTestsQuery(quizId);
  const create = useCreateSoloTestMutation();
  const [creating, setCreating] = useState(false);
  const empty = questionCount === 0;

  const practice = () =>
    create.mutate(
      { quizId, practice: true },
      {
        onSuccess: (test) => router.push(`/solo/${test.code}`),
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );

  return (
    <div className="flex flex-col w-[90%] mx-auto text-dark dark:text-white">
      <div className="flex items-center justify-between mt-6 mb-3">
        <h4 className="text-sm font-bold tracking-[0.04em] uppercase text-[#8a8896] dark:text-muted-dark">
          Play alone
        </h4>
        <span className="rounded-full px-2.5 py-0.5 text-xs bg-lprimary/10 dark:bg-white/5 text-off-dark dark:text-muted-dark">
          {tests.data?.length ?? 0}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="!border-[1.5px] whitespace-nowrap"
          disabled={empty || create.isPending}
          onClick={practice}
          leftIcon={<LuUser size={16} />}
        >
          Play alone
        </Button>
        <Button
          size="sm"
          className="whitespace-nowrap"
          disabled={empty}
          onClick={() => setCreating(true)}
          leftIcon={<LuClipboardList size={16} />}
        >
          Create test
        </Button>
      </div>
      <p className="mt-2 text-xs text-off-dark dark:text-muted-dark">
        A test is a link: everyone plays the quiz on their own, with the time
        limits, whenever suits them.
      </p>
      <div className="flex flex-col gap-2.5 mt-3">
        {tests.data?.map((test) => (
          <TestCard key={test.id} test={test} onShowReport={onShowReport} />
        ))}
      </div>
      <CreateTestModal
        open={creating}
        onClose={() => setCreating(false)}
        quizId={quizId}
      />
    </div>
  );
}

function TestCard({
  test,
  onShowReport,
}: {
  test: SoloTestItem;
  onShowReport?: (testId: string) => void;
}) {
  const update = useUpdateSoloTestMutation();
  const del = useDeleteSoloTestMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(soloLink(test.code));
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="rounded-[14px] p-3.5 border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5">
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[12.5px] font-medium text-off-dark dark:text-muted-dark">
          {fmt(test.createdAt)}
        </span>
        <span className="text-[13px] font-extrabold tracking-[0.06em] rounded-[7px] px-2 py-0.5 text-lprimary dark:text-dprimary bg-lprimary/10 dark:bg-white/5">
          {test.code}
        </span>
      </div>
      <div className="text-xs mt-2 text-off-dark dark:text-muted-dark">
        {test.finished} finished · {test.started} started ·{" "}
        {test.closed ? (
          <b className="text-red-light dark:text-red-dark">Closed</b>
        ) : test.closesAt ? (
          `Open until ${fmt(test.closesAt)}`
        ) : (
          "Open, no deadline"
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2 -mx-1 text-lprimary dark:text-dprimary">
        <button
          type="button"
          className={actionClass}
          onClick={() => onShowReport?.(test.id)}
        >
          <LuChartBar size={14} />
          Report
        </button>
        <button type="button" className={actionClass} onClick={copy}>
          <LuCopy size={14} />
          Copy link
        </button>
        <button
          type="button"
          className={actionClass}
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: test.id, closesAt: test.closed ? null : "now" },
              { onError: (err) => toast.error(getApiErrorMessage(err)) },
            )
          }
        >
          {test.closed ? <LuLockOpen size={14} /> : <LuLock size={14} />}
          {test.closed ? "Reopen" : "Close now"}
        </button>
        <button
          type="button"
          className={clsx(actionClass, "text-red-light dark:text-red-dark")}
          onClick={() => setConfirmDelete(true)}
        >
          <LuTrash2 size={14} />
          Delete
        </button>
      </div>
      <ConfirmationModal
        open={confirmDelete}
        setOpen={setConfirmDelete}
        desc="Delete this test and everyone's results? The link stops working. This can't be undone."
        confirmLabel="Delete"
        confirming={del.isPending}
        confirmingLabel="Deleting…"
        onClick={() =>
          del.mutate(test.id, {
            onSuccess: () => setConfirmDelete(false),
            onError: (err) => toast.error(getApiErrorMessage(err)),
          })
        }
      />
    </div>
  );
}

/** Makes a test (optionally with a deadline), then shows its link and QR. */
function CreateTestModal({
  open,
  onClose,
  quizId,
}: {
  open: boolean;
  onClose: () => void;
  quizId: string;
}) {
  const create = useCreateSoloTestMutation();
  const [deadline, setDeadline] = useState("");
  const [made, setMade] = useState<SoloTestItem | null>(null);

  const close = () => {
    setMade(null);
    setDeadline("");
    onClose();
  };

  const submit = () =>
    create.mutate(
      {
        quizId,
        // datetime-local is local time; the server takes an instant.
        closesAt: deadline ? new Date(deadline).toISOString() : undefined,
      },
      {
        onSuccess: setMade,
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );

  return (
    <Modal open={open} onClose={close} aria-labelledby="create-test-title">
      <Box
        sx={modalStyle}
        className="bg-light-bg dark:bg-dark-bg rounded-2xl w-[92vw] max-w-[440px] p-6 text-dark dark:text-white"
      >
        <ModalCloseButton onClose={close} />
        <h2 id="create-test-title" className="text-lg font-black">
          {made ? "Your test is ready" : "Create test"}
        </h2>
        {made ? (
          <div className="mt-4 flex flex-col gap-4">
            <ShareRoom
              url={soloLink(made.code)}
              caption="SCAN TO PLAY"
              toastMessage="Link copied"
            />
            <Button size="sm" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <p className="text-sm text-off-dark dark:text-muted-dark">
              Players open the link, enter a name and play the quiz on their
              own. You see the results in the report.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Deadline (optional)</span>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClass}
              />
            </label>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button size="sm" disabled={create.isPending} onClick={submit}>
                Create test
              </Button>
            </div>
          </div>
        )}
      </Box>
    </Modal>
  );
}
