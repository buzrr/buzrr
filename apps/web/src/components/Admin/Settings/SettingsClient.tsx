"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { z } from "zod";
import GridListToggle from "@/components/Admin/GridListToggle";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import SignOutButton from "@/components/Admin/SignOutButton";
import DeleteProfileButton from "@/components/Admin/Settings/DeleteProfileButton";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { DEFAULT_AVATAR } from "@/constants";
import { authClient } from "@/lib/auth-client";
import { useEntitlementsQuery } from "@/lib/modules/billing/hooks";
import { useInstance } from "@/lib/instance-context";
import { LuImagePlus, LuTrash2 } from "react-icons/lu";
import { BUILTIN_SOUND_SKINS } from "@buzrr/contract";
import { getApiErrorMessage } from "@/lib/api/errors";
import { BUILTIN_SKINS, type BuiltinSkinId } from "@/lib/sound/synth";
import { useSoundSkinsQuery } from "@/lib/modules/sound-skins/hooks";
import {
  usePreferencesQuery,
  useSetDefaultLogo,
  useUpdatePreferences,
} from "@/lib/modules/preferences/hooks";
import { AVATAR_SKIN_NAMES } from "@/components/Admin/AvatarSkins/AvatarSkinsClient";

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be at most 50 characters"),
  image: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .startsWith("https://", "Must be an https:// URL")
    .or(z.literal("")),
});

type AccountValues = z.infer<typeof accountSchema>;

function SettingsCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white dark:bg-card-dark rounded-xl p-6 ${className ?? ""}`}
    >
      <h2 className="text-lg font-black text-dark dark:text-white">{title}</h2>
      <p className="text-xs text-off-dark dark:text-off-white mt-1">
        {description}
      </p>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function PreferenceRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-dark dark:text-white">{label}</p>
        <p className="text-xs text-off-dark dark:text-off-white">
          {description}
        </p>
      </div>
      {control}
    </div>
  );
}

function PreferencesCard() {
  return (
    <SettingsCard
      title="Appearance & Preferences"
      description="How Buzrr looks and behaves for you. Saved on this device."
    >
      <PreferenceRow
        label="Theme"
        description="Switch between light and dark mode."
        control={<ThemeToggle />}
      />
      <PreferenceRow
        label="Default quiz view"
        description="How your quizzes are laid out on the Quizzes page."
        control={<GridListToggle />}
      />
    </SettingsCard>
  );
}

/** Defaults for all the user's games: logo, audio skin, avatar skin. */
function GameDefaultsCard() {
  const prefs = usePreferencesQuery();
  const update = useUpdatePreferences();
  const setLogo = useSetDefaultLogo();
  const skins = useSoundSkinsQuery();
  const logoInput = useRef<HTMLInputElement>(null);
  const logo = prefs.data?.defaultLogo ?? null;
  const onErr = (err: unknown) => toast.error(getApiErrorMessage(err));
  return (
    <SettingsCard
      title="Game defaults"
      description="Used by all your quizzes unless a quiz sets its own."
    >
      <PreferenceRow
        label="Default logo"
        description="Shown on game screens instead of the site logo."
        control={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              disabled={setLogo.isPending}
              title={logo ? "Change logo" : "Upload a logo"}
              className="size-14 shrink-0 rounded-xl border-[1.5px] border-dashed border-lprimary/25 dark:border-white/15 flex items-center justify-center overflow-hidden cursor-pointer hover:border-dprimary"
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed upload URL
                <img
                  src={logo}
                  alt="Default logo"
                  className="max-h-full max-w-full object-contain p-1"
                />
              ) : (
                <LuImagePlus
                  size={22}
                  className="text-lprimary dark:text-dprimary"
                />
              )}
            </button>
            {logo && (
              <button
                type="button"
                aria-label="Remove default logo"
                onClick={() => setLogo.mutate(null, { onError: onErr })}
                className="size-8 rounded-[9px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:text-[#e5544e] cursor-pointer"
              >
                <LuTrash2 size={16} />
              </button>
            )}
            <input
              ref={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (f) setLogo.mutate(f, { onError: onErr });
              }}
            />
          </div>
        }
      />
      <PreferenceRow
        label="Default audio skin"
        description="Music and effects of quizzes set to “Default”."
        control={
          <select
            aria-label="Default audio skin"
            value={prefs.data?.defaultSoundSkin ?? "builtin:show"}
            disabled={update.isPending || !prefs.data}
            onChange={(e) =>
              update.mutate(
                { defaultSoundSkin: e.target.value },
                { onError: onErr },
              )
            }
            className="w-44 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent dark:bg-dark px-2 py-1 text-[13px] text-dark dark:text-white"
          >
            {BUILTIN_SOUND_SKINS.map((id) => (
              <option key={id} value={id}>
                {BUILTIN_SKINS[id as BuiltinSkinId].name}
              </option>
            ))}
            {(skins.data ?? []).map((sk) => (
              <option key={sk.id} value={sk.id}>
                {sk.name}
              </option>
            ))}
          </select>
        }
      />
      <PreferenceRow
        label="Default avatar skin"
        description="The pictures players pick from."
        control={
          <Link
            href="/admin/avatar-skins"
            className="text-sm font-semibold text-lprimary dark:text-dprimary hover:underline whitespace-nowrap"
          >
            {AVATAR_SKIN_NAMES[prefs.data?.defaultAvatarSkin ?? "original"]} →
          </Link>
        }
      />
    </SettingsCard>
  );
}

function AccountCard() {
  // How this account signs in (Google, or email + password), not assumed.
  const [signInMethod, setSignInMethod] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void authClient
      .listAccounts()
      .then((res) => {
        if (!alive) return;
        const ids = (res.data ?? []).map((a) => a.providerId);
        setSignInMethod(
          ids.includes("google")
            ? "Google"
            : ids.includes("credential")
              ? "email and password"
              : null,
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", image: "" },
  });

  useEffect(() => {
    if (session) {
      reset({
        name: session.user.name ?? "",
        image: session.user.image ?? "",
      });
    }
  }, [session, reset]);

  const imageValue = watch("image");
  const previewSrc =
    imageValue && imageValue.startsWith("https://")
      ? imageValue
      : DEFAULT_AVATAR;

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.updateUser({
      name: values.name,
      image: values.image || null,
    });
    if (error) {
      toast.error(error.message || "Could not update your profile.");
      return;
    }
    toast.success("Profile updated");
    queryClient.invalidateQueries({ queryKey: ["duel", "me"] });
    // Server components read the session through a short-lived cookie
    // cache; refresh so they don't keep showing the old name.
    router.refresh();
  });

  return (
    <SettingsCard
      title="Account"
      description="Your public identity across quizzes and duels."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextInput
          label="Display name"
          error={errors.name?.message}
          autoComplete="off"
          {...register("name")}
        />
        <div className="flex items-end gap-4">
          <TextInput
            label="Avatar URL"
            placeholder="https://..."
            error={errors.image?.message}
            autoComplete="off"
            containerClassName="flex-1"
            {...register("image")}
          />
          <Image
            src={previewSrc}
            className="rounded-full shrink-0 mb-1"
            alt="Avatar preview"
            width={48}
            height={48}
          />
        </div>
        <div>
          <p className="text-sm font-bold text-dark dark:text-white">Email</p>
          <p className="text-sm text-off-dark dark:text-off-white">
            {session?.user.email}
            {signInMethod ? ` · Signed in with ${signInMethod}` : ""} — email
            can&apos;t be changed here.
          </p>
        </div>
        <Button
          type="submit"
          size="sm"
          className="self-start"
          isLoading={isSubmitting}
          loadingText="Saving..."
        >
          Save changes
        </Button>
      </form>
    </SettingsCard>
  );
}

function PlanCard() {
  const { data } = useEntitlementsQuery();
  return (
    <SettingsCard
      title="Plan"
      description="Your Buzrr plan, usage and subscription."
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-dark dark:text-white">
          {data
            ? data.plan === "pro"
              ? "You're on Buzrr Pro."
              : "You're on the Free plan."
            : "Loading your plan…"}
        </p>
        <Link
          href="/admin/billing"
          className="text-sm font-bold text-lprimary dark:text-dprimary underline underline-offset-2"
        >
          Plan & Billing
        </Link>
      </div>
    </SettingsCard>
  );
}

function DangerZoneCard() {
  return (
    <SettingsCard
      title="Danger zone"
      description="Sign out of this device, or permanently delete your profile."
      className="border border-red-light dark:border-red-dark"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-64">
          <SignOutButton
            btnTitle="Sign out"
            confirmText="Are you sure you want to sign out?"
            btnStyle="text-sm text-white dark:text-dark dark:font-bold rounded-lg py-2 px-4 bg-red-light dark:bg-red-dark w-full cursor-pointer"
          />
        </div>
        <div className="w-full sm:w-64">
          <DeleteProfileButton />
        </div>
      </div>
    </SettingsCard>
  );
}

export default function SettingsClient() {
  const { billing } = useInstance();
  return (
    <div className="w-full p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="md:hidden">
          <NavbarToggle />
        </span>
        <h1 className="text-2xl font-black text-dark dark:text-white">
          Settings
        </h1>
      </div>
      <div className="flex flex-col gap-6">
        <PreferencesCard />
        <GameDefaultsCard />
        <AccountCard />
        {billing && <PlanCard />}
        <DangerZoneCard />
      </div>
    </div>
  );
}
