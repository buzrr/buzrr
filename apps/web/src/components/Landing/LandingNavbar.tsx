"use client";

import { useState } from "react";
import Link from "next/link";
import { LuGithub, LuMenu, LuX } from "react-icons/lu";
import ClientImage from "@/components/ClientImage";
import ThemeIconToggle from "./ThemeIconToggle";
import { GITHUB_LINK } from "./links";

const navLinks = [
  { name: "Docs", href: "/docs" },
  { name: "Roadmap", href: "/roadmap" },
  { name: "Changelog", href: "/changelog" },
];

const LandingNavbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur border-b border-card-light dark:border-card-dark">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        <Link href="/" aria-label="Buzrr home">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzrr Logo",
              width: 72,
              height: 72,
            }}
          />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-dark dark:text-gray hover:text-lprimary dark:hover:text-dprimary transition-colors"
            >
              {link.name}
            </Link>
          ))}
          <a
            href={GITHUB_LINK}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-dark dark:text-gray hover:text-lprimary dark:hover:text-dprimary transition-colors"
          >
            <LuGithub size={16} />
            GitHub
          </a>
          <ThemeIconToggle />
        </div>

        <div className="flex md:hidden items-center gap-3">
          <ThemeIconToggle />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center size-9 rounded-lg text-dark dark:text-white"
          >
            {open ? <LuX size={22} /> : <LuMenu size={22} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden border-t border-card-light dark:border-card-dark bg-light-bg dark:bg-dark-bg px-4 pb-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm font-medium text-dark dark:text-gray border-b border-card-light dark:border-card-dark"
            >
              {link.name}
            </Link>
          ))}
          <a
            href={GITHUB_LINK}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 py-3 text-sm font-medium text-dark dark:text-gray"
          >
            <LuGithub size={16} />
            GitHub
          </a>
        </div>
      )}
    </header>
  );
};

export default LandingNavbar;
