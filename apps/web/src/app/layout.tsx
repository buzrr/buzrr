import "./globals.css";
import { IBM_Plex_Sans } from "next/font/google";
import ReduxProvider from "@/state/ReduxProvider";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buzzr",
  description: "Buzzr is a platform for hosting quizzes and games",
};

const sans = IBM_Plex_Sans({
  weight: ["400"],
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.className} bg-light-bg dark:bg-dark-bg h-fit overflow-x-hidden`}
      >
        <ReduxProvider>
          {children}
          <Footer />
        </ReduxProvider>
      </body>
    </html>
  );
}
