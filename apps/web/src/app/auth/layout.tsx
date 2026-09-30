import Link from "next/link";
import ClientImage from "@/components/ClientImage";

import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// App screens, not landing pages: keep them out of search results.
export const metadata = NOINDEX_METADATA;

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div className="p-2 px-4 md:px-8 bg-light-bg dark:bg-dark-bg hidden md:block">
        <Link href="/">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzrr Logo",
              width: 80,
              height: 80,
            }}
          />
        </Link>
      </div>
      {children}
    </>
  );
};

export default AuthLayout;
