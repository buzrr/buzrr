"use client";
import clsx from "clsx";
import { DEFAULT_AVATAR } from "@/constants";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import ClientImage from "../ClientImage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuBookText,
  LuHistory,
  LuLogOut,
  LuSettings,
  LuShieldCheck,
  LuUserCog,
} from "react-icons/lu";
import { useAppSelector, useAppDispatch } from "@/state/hooks";
import { NavToggle, setNavToggle } from "@/state/admin/navtoggleSlice";
import { useCurrentRole } from "@/components/SessionProvider";
import { LICENSE_LINK } from "@/components/Landing/links";
import SignOutButton from "./SignOutButton";

const NavLinks = [
  { href: "/admin", label: "Quizzes", icon: LuBookText },
  { href: "/admin/history", label: "History", icon: LuHistory },
  { href: "/admin/settings", label: "Settings", icon: LuSettings },
];

export default function Navbar() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const role = useCurrentRole();

  const toggle = useAppSelector((state) => state.navToggle.toggle);
  const dispatch = useAppDispatch();

  // Root link matches exactly; others also match their nested routes.
  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  const navLinks = [
    ...NavLinks,
    ...(role === "admin" || role === "superadmin"
      ? [
          {
            href: "/admin/moderation",
            label: "Question Review",
            icon: LuShieldCheck,
          },
        ]
      : []),
    ...(role === "superadmin"
      ? [
          {
            href: "/admin/superadmin/admins",
            label: "Manage Admins",
            icon: LuUserCog,
          },
        ]
      : []),
  ];

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-10 bg-[#0000006a] md:hidden",
          toggle === NavToggle.collapse && "hidden",
        )}
        onClick={() => dispatch(setNavToggle(NavToggle.collapse))}
      ></div>
      <div
        className={clsx(
          "z-20 p-6 px-8 flex bg-light-bg dark:bg-dark-bg flex-col h-dvh md:h-[85vh] fixed top-0 left-0 md:relative md:top-auto md:left-auto w-[80vw] md:w-[25%] overflow-y-auto",
          toggle === NavToggle.collapse && "hidden md:flex",
        )}
      >
        <div className="flex justify-center items-center md:hidden p-5 mb-2 border-b border-gray">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzrr Logo",
              width: 90,
              height: 90,
            }}
          />
        </div>
        <div className="flex flex-col">
          <div className="p-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "my-1 py-2 px-4 rounded-lg flex items-center gap-3",
                  !isActive(link.href)
                    ? "hover:bg-card-light hover:dark:bg-card-dark dark:text-white transition-colors duration-200 ease-in-out"
                    : "bg-lprimary text-white dark:bg-dprimary dark:text-dark dark:font-extrabold",
                )}
                onClick={() => {
                  dispatch(setNavToggle(NavToggle.collapse));
                }}
              >
                <link.icon size={18} className="shrink-0" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-auto mb-2 pt-6 border-t border-t-gray">
          <Link
            href="/admin/profile"
            className={clsx(
              "flex items-center p-2 px-4 rounded-md",
              !isActive("/admin/profile")
                ? "hover:bg-card-light dark:hover:bg-card-dark transition-colors duration-200 ease-in-out"
                : "bg-lprimary dark:bg-dprimary",
            )}
            onClick={() => {
              dispatch(setNavToggle(NavToggle.collapse));
            }}
          >
            <Image
              src={session?.user?.image || DEFAULT_AVATAR}
              className="rounded-full mr-2"
              alt="Profile Picture"
              width={40}
              height={40}
            />
            <span
              className={clsx(
                "text-md",
                !isActive("/admin/profile")
                  ? "text-dark dark:text-white"
                  : "text-white dark:text-dark dark:font-extrabold",
              )}
            >
              {session?.user?.name}
            </span>
          </Link>
          <SignOutButton
            btnTitle="Logout"
            confirmText="Are you sure you want to log out?"
            btnContent={
              <span className="flex items-center gap-3">
                <LuLogOut size={18} className="shrink-0" />
                Logout
              </span>
            }
            btnStyle="my-1 py-2 px-4 rounded-lg flex items-center w-full text-dark dark:text-white hover:bg-card-light hover:dark:bg-card-dark transition-colors duration-200 ease-in-out hover:cursor-pointer"
          />
          <div className="p-2 px-4">
            <div className="text-xs text-off-dark dark:text-off-white mt-2">
              Licensed under{" "}
              <a
                href={LICENSE_LINK}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-1"
              >
                GPL-3.0
              </a>
              <br />
              <br />
              Buzrr v{process.env.NEXT_PUBLIC_VERSION || "0.0.1"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
