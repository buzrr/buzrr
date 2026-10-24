"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import modalStyle from "@/utils/modalStyle";
import { queryKeys } from "@/lib/modules/query-keys";
import {
  createUserAction,
  resetPasswordAction,
} from "@/app/admin/(privileged)/superadmin/admins/actions";
import { toast } from "react-toastify";
import Image from "next/image";
import { DEFAULT_AVATAR } from "@/constants";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useAdminsQuery,
  useDemoteUserMutation,
  usePromoteUserMutation,
} from "@/lib/modules/admin-users/hooks";
import type { AdminUserItem } from "@/lib/modules/admin-users/api";
import { TextInput } from "@/components/ui/TextInput";
import { useT, tx } from "@/lib/i18n/context";
import { Button } from "@/components/ui/Button";

/** A first guess; rows are measured (taller on phones, actions wrap). */
const ROW_HEIGHT = 76;
const DEBOUNCE_MS = 300;

export default function AdminsListClient() {
  const t = useT();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const promote = usePromoteUserMutation();
  const demote = useDemoteUserMutation();
  const parentRef = useRef<HTMLDivElement>(null);
  const [resetFor, setResetFor] = useState<AdminUserItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useAdminsQuery(search);

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (
      lastItem &&
      lastItem.index >= items.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [lastItem, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  function handlePromote(userId: string) {
    promote.mutate(userId, {
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  }

  function handleDemote(userId: string) {
    demote.mutate(userId, {
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  }

  return (
    <div className="mt-4">
      <AddUserForm />
      <TextInput
        placeholder={t("Search by name or email…")}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        containerClassName="max-w-md mt-6"
      />
      <p className="mt-1 text-xs text-off-dark dark:text-off-white">
        {search
          ? t("Showing search results across all users.")
          : t("Showing all users.")}
      </p>

      {query.isPending ? (
        <p className="mt-4 text-dark dark:text-white">Loading…</p>
      ) : query.isError ? (
        <p className="mt-4 text-red-light dark:text-red-dark">
          {getApiErrorMessage(query.error)}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-dark dark:text-white">No users found.</p>
      ) : (
        <div
          ref={parentRef}
          className="mt-4 h-[65dvh] overflow-y-auto rounded-xl border border-gray"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const item = items[virtualRow.index];
              if (!item) return null;
              return (
                <div
                  key={item.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-gray px-3 md:px-4 py-3"
                >
                  <AdminRow
                    item={item}
                    pending={
                      (promote.isPending &&
                        promote.variables?.userId === item.id) ||
                      (demote.isPending && demote.variables?.userId === item.id)
                    }
                    onPromote={() => handlePromote(item.id)}
                    onDemote={() => handleDemote(item.id)}
                    onResetPassword={() => setResetFor(item)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />
    </div>
  );
}

function AdminRow({
  item,
  pending,
  onPromote,
  onDemote,
  onResetPassword,
}: {
  item: AdminUserItem;
  pending: boolean;
  onPromote: () => void;
  onDemote: () => void;
  onResetPassword: () => void;
}) {
  const t = useT();
  // One grid for every row, so avatar, name, role and actions line up
  // down the list. Phones: the actions go under the name.
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] md:grid-cols-[40px_minmax(0,1fr)_88px_auto] items-center gap-x-3 gap-y-2">
      <Image
        src={item.image || DEFAULT_AVATAR}
        width={40}
        height={40}
        alt=""
        className="size-10 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="truncate font-bold text-dark dark:text-white">
          {item.name ?? t("Unnamed")}
        </p>
        <p
          className="truncate text-sm text-off-dark dark:text-off-white"
          title={item.email}
        >
          {item.email}
        </p>
      </div>
      <span className="justify-self-end md:justify-self-start rounded-full bg-lprimary/20 dark:bg-dprimary/20 px-2 py-0.5 text-xs font-bold capitalize text-lprimary dark:text-dprimary">
        {item.role}
      </span>
      <div className="col-start-2 col-span-2 md:col-start-auto md:col-span-1 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 md:flex-none whitespace-nowrap !border !py-1.5"
          onClick={onResetPassword}
        >
          {t("Reset password")}
        </Button>
        {/* Same width whether it promotes, demotes or (superadmin) is
            empty, so "Reset password" stays in one column. */}
        <span className="flex-1 md:flex-none md:w-40 flex">
          {item.role === "user" && (
            <Button
              size="sm"
              disabled={pending}
              className="w-full whitespace-nowrap !py-1.5"
              onClick={onPromote}
            >
              {t("Promote to admin")}
            </Button>
          )}
          {item.role === "admin" && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              className="w-full whitespace-nowrap !border !py-1.5"
              onClick={onDemote}
            >
              {t("Demote to user")}
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}

/** Creates a local email + password account (works with sign-up closed). */
function AddUserForm() {
  const t = useT();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createUserAction({ name, email, password, role });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        tx("User {email} created", { email: email.trim().toLowerCase() }),
      );
      setName("");
      setEmail("");
      setPassword("");
      setRole("user");
      queryClient.invalidateQueries({ queryKey: queryKeys.admins.lists });
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 rounded-xl border border-gray p-4 flex flex-col gap-3"
    >
      <p className="font-bold text-dark dark:text-white">Add user</p>
      <div className="grid gap-3 md:grid-cols-4">
        <TextInput
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextInput
          type="password"
          placeholder="Password (min. 8)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "user" | "admin")}
          className="rounded-xl border border-gray bg-transparent px-3 py-2 text-dark dark:text-white dark:bg-dark"
          aria-label="Role"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div>
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Creating…" : t("Create user")}
        </Button>
      </div>
    </form>
  );
}

/** Sets a new password and signs the user out of all sessions. */
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: AdminUserItem | null;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");

  function close() {
    setPassword("");
    onClose();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    startTransition(async () => {
      const res = await resetPasswordAction({ userId: user.id, password });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tx("Password for {email} reset", { email: user.email }));
      close();
    });
  }

  return (
    <Modal
      open={user !== null}
      onClose={close}
      aria-labelledby="reset-pw-title"
    >
      <Box
        sx={modalStyle}
        className="bg-light-bg dark:bg-dark-bg rounded-2xl w-[90vw] max-w-[430px] p-6"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <h2
            id="reset-pw-title"
            className="text-lg font-black text-dark dark:text-white"
          >
            Reset password
          </h2>
          <p className="text-sm text-dark/80 dark:text-gray">
            New password for <strong>{user?.email}</strong>. The user is signed
            out everywhere.
          </p>
          <TextInput
            type="password"
            placeholder={t("New password (min. 8)")}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" type="button" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={pending}>
              {pending ? "Saving…" : t("Set password")}
            </Button>
          </div>
        </form>
      </Box>
    </Modal>
  );
}
