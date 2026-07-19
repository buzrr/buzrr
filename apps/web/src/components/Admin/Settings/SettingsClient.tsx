"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
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

function AccountCard() {
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
        <DangerZoneCard />
      </div>
    </div>
  );
}
