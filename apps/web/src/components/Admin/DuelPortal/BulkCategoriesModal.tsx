"use client";

import { useState } from "react";
import { Box, Modal } from "@mui/material";
import { toast } from "react-toastify";
import type { BulkSetCategories } from "@buzrr/contract";
import CategoryChips from "@/components/Admin/CategoryChips";
import ModalCloseButton from "@/components/ModalCloseButton";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useBulkSetCategoriesMutation } from "@/lib/modules/moderation/hooks";
import style from "@/utils/modalStyle";

type Mode = BulkSetCategories["mode"];

const MODES: { value: Mode; label: string; hint: string }[] = [
  {
    value: "add",
    label: "Add",
    hint: "Tag on top of their current categories.",
  },
  { value: "remove", label: "Remove", hint: "Untag these categories." },
  {
    value: "replace",
    label: "Replace",
    hint: "Set exactly these categories (none clears them).",
  },
];

/** Map categories onto every selected question at once. */
export default function BulkCategoriesModal({
  ids,
  open,
  onClose,
  onDone,
}: {
  ids: string[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("add");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const mutation = useBulkSetCategoriesMutation();

  const close = () => {
    if (mutation.isPending) return;
    setCategoryIds([]);
    setMode("add");
    onClose();
  };

  const apply = () => {
    mutation.mutate(
      { ids, categoryIds, mode },
      {
        onSuccess: (result) => {
          const skipped = result.skipped.length;
          toast.success(
            `Updated ${result.updated} question${result.updated === 1 ? "" : "s"}` +
              (skipped
                ? ` · ${skipped} skipped (${result.skipped[0]!.reason})`
                : ""),
          );
          setCategoryIds([]);
          setMode("add");
          onDone();
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  const hint = MODES.find((m) => m.value === mode)!.hint;
  const canApply = mode === "replace" || categoryIds.length > 0;

  return (
    <Modal open={open} onClose={close} aria-labelledby="bulk-categories-title">
      <Box
        sx={style}
        className="bg-light-bg dark:bg-card-dark w-[92vw] max-w-[520px] max-h-[90dvh] overflow-y-auto"
      >
        {!mutation.isPending && <ModalCloseButton onClose={close} />}
        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2
              id="bulk-categories-title"
              className="text-lg font-bold text-dark dark:text-white"
            >
              Categories for {ids.length} question{ids.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-sm text-off-dark dark:text-off-white">
              {hint}
            </p>
          </div>
          <Segmented
            label="How to apply"
            value={mode}
            onChange={setMode}
            options={MODES}
          />
          <CategoryChips
            value={categoryIds}
            onChange={setCategoryIds}
            disabled={mutation.isPending}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={close}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={apply}
              disabled={!canApply}
              isLoading={mutation.isPending}
              loadingText="Applying…"
            >
              Apply
            </Button>
          </div>
        </div>
      </Box>
    </Modal>
  );
}
