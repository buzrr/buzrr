"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { z } from "zod";
import GridListToggle from "@/components/Admin/GridListToggle";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import SignOutButton from "@/components/Admin/SignOutButton";
import DeleteProfileButton from "@/components/Admin/Settings/DeleteProfileButton";
import SelectProfile, { PROFILES } from "@/components/Player/SelectProfile";
import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { authClient } from "@/lib/auth-client";
import { useEntitlementsQuery } from "@/lib/modules/billing/hooks";

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be at most 50 characters"),
  // Set by the avatar picker only: a preset path, the account's own photo URL,
  // or "" for the default avatar.
  image: z.string(),
});

type AccountValues = z.infer<typeof accountSchema>;

const accountPhotoKey = (userId: string) => `buzrr:account-photo:${userId}`;

/**
 * The account's own photo (e.g. from Google), offered as the first avatar.
 * Saving a preset overwrites `user.image`, so it is remembered on this device
 * to keep it selectable afterwards. Storage may be unavailable, which only
 * means the photo can't be offered again once replaced.
 */
function resolveAccountPhoto(userId: string, image: string | null | undefined) {
  const key = accountPhotoKey(userId);
  try {
    if (image && !PROFILES.includes(image)) {
      localStorage.setItem(key, image);
      return image;
    }
    return localStorage.getItem(key) ?? "";
  } catch {
    return image && !PROFILES.includes(image) ? image : "";
  }
}

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

function AccountCard() {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
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

  const userId = session?.user.id;
  const sessionImage = session?.user.image;
  const avatarOptions = useMemo(
    () => [
      userId ? resolveAccountPhoto(userId, sessionImage) : "",
      ...PROFILES,
    ],
    [userId, sessionImage],
  );

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
        <div className="max-w-md">
          <SelectProfile
            data={{ name: "", image: watch("image") }}
            options={avatarOptions}
            setData={({ image }) =>
              setValue("image", image, { shouldDirty: true })
            }
          />
        </div>
        <div>
          <p className="text-sm font-bold text-dark dark:text-white">Email</p>
          <p className="text-sm text-off-dark dark:text-off-white">
            {session?.user.email} · Signed in with Google — email can&apos;t be
            changed here.
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
        <AccountCard />
        <PlanCard />
        <DangerZoneCard />
      </div>
    </div>
  );
}
