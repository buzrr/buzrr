"use client";

import { useState } from "react";
import { LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { toast } from "react-toastify";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { categorySwatch } from "@/components/Duel/duelUi";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { CategoryWithCount } from "@/lib/modules/categories/api";
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from "@/lib/modules/categories/hooks";

const DEFAULT_HUE = 270;

export default function CategoriesClient() {
  const query = useCategoriesQuery();
  const create = useCreateCategoryMutation();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null);
  const remove = useDeleteCategoryMutation();

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`Deleted "${deleting.name}"`);
        setDeleting(null);
      },
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-off-dark dark:text-off-white">
          Categories decide which duel topics serve a question. A category shows
          up for players once it has 7 approved questions.
        </p>
        {!adding && (
          <Button
            size="sm"
            leftIcon={<LuPlus />}
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
          >
            New category
          </Button>
        )}
      </div>

      {adding && (
        <CategoryForm
          submitLabel="Create"
          pending={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(body) =>
            create.mutate(body, {
              onSuccess: () => {
                toast.success(`Created "${body.name}"`);
                setAdding(false);
              },
              onError: (err) => toast.error(getApiErrorMessage(err)),
            })
          }
        />
      )}

      {query.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-red-light dark:text-red-dark">
          {getApiErrorMessage(query.error)}
        </p>
      ) : query.data.length === 0 ? (
        <p className="text-dark dark:text-white">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-gray rounded-xl border border-gray">
          {query.data.map((category) =>
            editingId === category.id ? (
              <li key={category.id} className="p-3">
                <EditCategory
                  category={category}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={category.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-[5px]"
                  style={{ background: categorySwatch(category.hue) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-dark dark:text-white">
                    {category.name}
                  </p>
                  <p className="text-xs text-off-dark dark:text-off-white">
                    {category.slug} · {category.questionCount} question
                    {category.questionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <IconButton
                  aria-label={`Edit ${category.name}`}
                  icon={<LuPencil size={16} />}
                  className="rounded-lg text-dark dark:text-white hover:bg-card-light dark:hover:bg-card-dark"
                  onClick={() => {
                    setAdding(false);
                    setEditingId(category.id);
                  }}
                />
                <IconButton
                  aria-label={`Delete ${category.name}`}
                  icon={<LuTrash2 size={16} />}
                  className="rounded-lg text-red-light dark:text-red-dark hover:bg-card-light dark:hover:bg-card-dark"
                  onClick={() => setDeleting(category)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      <ConfirmationModal
        open={deleting !== null}
        setOpen={(open) => {
          if (!open) setDeleting(null);
        }}
        onClick={confirmDelete}
        confirmLabel="Delete"
        confirming={remove.isPending}
        confirmingLabel="Deleting…"
        desc={deleting ? deleteWarning(deleting) : undefined}
      />
    </div>
  );
}

function deleteWarning(category: CategoryWithCount): string {
  const n = category.questionCount;
  const untag =
    n > 0 ? ` It will be removed from ${n} question${n === 1 ? "" : "s"}.` : "";
  return `Delete "${category.name}"?${untag} Players' ${category.name} duel ratings will be reset. This can't be undone.`;
}

function EditCategory({
  category,
  onDone,
}: {
  category: CategoryWithCount;
  onDone: () => void;
}) {
  const update = useUpdateCategoryMutation();
  return (
    <CategoryForm
      initial={category}
      submitLabel="Save"
      pending={update.isPending}
      onCancel={onDone}
      onSubmit={(body) =>
        update.mutate(
          { id: category.id, body },
          {
            onSuccess: () => {
              toast.success("Category saved");
              onDone();
            },
            onError: (err) => toast.error(getApiErrorMessage(err)),
          },
        )
      }
    />
  );
}

function CategoryForm({
  initial,
  submitLabel,
  pending,
  onCancel,
  onSubmit,
}: {
  initial?: { name: string; hue: number };
  submitLabel: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (body: { name: string; hue: number }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [hue, setHue] = useState(initial?.hue ?? DEFAULT_HUE);
  const trimmed = name.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onSubmit({ name: trimmed, hue });
      }}
      className="flex flex-col gap-3 rounded-xl border border-gray p-4 sm:flex-row sm:items-end"
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-dark dark:text-white">
        Name
        <input
          autoFocus
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. History"
          className="w-full rounded-lg border border-gray bg-transparent px-3 py-2 font-normal outline-none focus:border-blue-600 dark:bg-dark-bg"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-dark dark:text-white sm:w-48">
        <span className="flex items-center gap-2">
          Colour
          <span
            className="h-4 w-4 rounded-[5px]"
            style={{ background: categorySwatch(hue) }}
          />
        </span>
        <input
          type="range"
          min={0}
          max={360}
          value={hue}
          onChange={(e) => setHue(Number(e.target.value))}
          aria-label="Colour hue"
          className="h-9 w-full cursor-pointer accent-lprimary dark:accent-dprimary"
        />
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          size="sm"
          type="submit"
          disabled={!trimmed}
          isLoading={pending}
          loadingText="Saving…"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
