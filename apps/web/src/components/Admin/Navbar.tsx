"use client";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import ClientImage from "../ClientImage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RootState } from "@/state/store";
import { useSelector, useDispatch } from "react-redux";
import { navToggle, setNavToggle } from "@/state/admin/navtoggleSlice";
import BasicModal from "../Modal";

const NavLinks = [
  { href: "/admin", label: "Quizzes" },
  { href: "/admin/settings", label: "Settings" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const toggle = useSelector((state: RootState) => state.navToggle.toggle);
  const dispatch = useDispatch();

  return (
    <>
      <div
        className={`absolute top-0 left-0 w-screen h-screen z-10 bg-[#0000006a] md:hidden ${toggle === navToggle.collapse ? "hidden" : ""}`}
        onClick={() => dispatch(setNavToggle(navToggle.collapse))}
      ></div>
      <div
        className={`z-20 p-6 px-8 flex bg-light-bg dark:bg-dark-bg flex-col h-screen md:h-[85vh] absolute md:relative w-[80vw] md:w-[25%] left-0 ${toggle === navToggle.collapse ? "hidden md:flex" : ""}`}
      >
        <div className="flex justify-center items-center md:hidden p-5 mb-2 border-b border-gray">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzzr Logo",
              width: 90,
              height: 90,
            }}
          />
        </div>
        <div className="flex flex-col">
          <div className="p-2">
            {NavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`my-1 py-2 px-4 rounded-lg flex items-center ${
                  pathname != link.href
                    ? "hover:bg-card-light hover:dark:bg-card-dark dark:text-white transition-colors duration-200 ease-in-out"
                    : "bg-lprimary text-white dark:bg-dprimary dark:text-dark dark:font-extrabold"
                }`}
                onClick={() => {
                  toggle === navToggle.collapse
                    ? dispatch(setNavToggle(navToggle.expand))
                    : dispatch(setNavToggle(navToggle.collapse));
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-auto mb-2 pt-6 border-t border-t-gray">
          <div className="flex items-center p-2 px-4 hover:cursor-pointer hover:bg-card-light dark:hover:bg-card-dark rounded-md">
            <Image
              src={session?.user?.image || "/images/avatar-1577909_1280.webp"}
              className="rounded-full mr-2"
              alt="Profile Picture"
              width={40}
              height={40}
            />
            <span className="text-dark text-md dark:text-white">
              {session?.user?.name}
            </span>
          </div>
          <div className="p-2 px-4">
            <BasicModal
              btnTitle="Sign out"
              btnStyle="text-sm text-white dark:text-dark dark:font-bold rounded-lg py-2 px-4 my-2 bg-red-light dark:bg-red-dark w-full"
            >
              <div className="text-center">
                <p className="text-dark dark:text-white">
                  Are you sure you want to sign out?
                </p>
                <button
                  className="text-sm text-white dark:text-dark dark:font-bold rounded-lg py-2 px-4 my-2 bg-red-light dark:bg-red-dark w-full"
                  onClick={() => signOut()}
                >
                  Sign out
                </button>
              </div>
            </BasicModal>
            <div className="text-xs text-off-dark dark:text-off-white mt-2">
              Licenced under &copy; Software Incubator
              <br />
              <Link href="#" className="underline underline-offset-1">
                Donate Us
              </Link>
              <br />
              <br />
              Buzzr v2
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
