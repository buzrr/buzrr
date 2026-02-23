"use client";

import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const Links = [
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
    name: "Youtube",
    link: "https://www.youtube.com/@BuzznoldBuzzenegger",
    icon: "/images/youtube.svg",
  },
  {
    name: "Github",
    link: "https://github.com/buzrr/buzrr",
    icon: "/images/github.svg",
  },
];

const Footer = () => {
  return (
    <div className="flex p-2 md:px-8 justify-start z-50 items-center text-sm text-[#94959c] dark:text-off-white w-fit md:w-full fixed bottom-0 right-3 md:right-0">
      {Links.map((link, index) => (
        <Link href={link.link} key={index} target="_blank">
          <div className="hidden md:flex items-center justify-center mr-2">
            <Image
              className="w-auto h-auto"
              src={link.icon}
              alt={link.name}
              width={18}
              height={18}
            />
            <span className="text-xs px-1 hidden md:inline">{link.name}</span>
          </div>
        </Link>
      ))}
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </div>
  );
};

export default Footer;
