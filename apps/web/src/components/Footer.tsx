"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuMail } from "react-icons/lu";
import ThemeToggle from "./ThemeToggle";
import { ISSUES_LINK } from "./Landing/links";
import supportLinks from "@/data/support-links.json";

// Routes that render their own full footer + theme toggle (landing & co).
const ROUTES_WITH_OWN_FOOTER = [
  "/",
  "/docs",
  "/roadmap",
  "/changelog",
  "/support",
];

const Links = [
  {
    name: "Contact us",
    link: ISSUES_LINK,
    icon: null,
  },
  {
    name: "Donate",
    link: supportLinks.supportPage,
    icon: "/images/donate.svg",
    internal: true,
  },
  {
    name: "Instagram",
    link: "https://www.instagram.com/buzrr.in/",
    icon: "/images/instagram.svg",
  },
  {
    name: "Discord",
    link: "#",
    icon: "/images/discord.svg",
  },
  {
    name: "YouTube",
    link: "https://www.youtube.com/@BuzznoldBuzzenegger",
    icon: "/images/youtube.svg",
  },
  {
    name: "Github",
    link: "https://github.com/buzrr/buzrr",
    icon: "/images/github.svg",
  },
  {
    name: "Software Incubator",
    link: "https://silive.in/",
    icon: "/images/incubator.svg",
  },
];

const Footer = () => {
  const pathname = usePathname();
  if (ROUTES_WITH_OWN_FOOTER.includes(pathname)) return null;

  return (
    <div className="fixed bottom-0 right-3 md:right-0 md:left-0 z-50 w-fit md:w-full md:bg-light-bg md:dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto flex items-center justify-start p-2 px-4 sm:px-6 lg:px-8 text-sm text-[#94959c] dark:text-off-white">
        {Links.map((link, index) => (
          <Link
            href={link.link}
            key={index}
            {...("internal" in link && link.internal
              ? {}
              : { target: "_blank" })}
          >
            <div className="hidden md:flex items-center justify-center mr-3">
              {link.icon ? (
                <Image
                  className="w-auto h-auto"
                  src={link.icon}
                  alt={link.name}
                  width={18}
                  height={18}
                />
              ) : (
                <LuMail size={16} />
              )}
              <span className="text-xs px-1 hidden md:inline">{link.name}</span>
            </div>
          </Link>
        ))}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

export default Footer;
