import type { Metadata } from "next";
import clsx from "clsx";
import { IBM_Plex_Sans } from "next/font/google";
import ReduxProvider from "@/state/ReduxProvider";
import Footer from "@/components/Footer";
import "./globals.css";

const baseUrl = "https://buzrr.in";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),

  title: {
    default:
      "Buzrr - Open Source Kahoot Alternative for Real-Time Multiplayer Quizzes",
    template: "%s | Buzrr",
  },

  description:
    "Buzrr is a powerful open source Kahoot alternative for hosting real-time multiplayer quizzes. Run live competitions, classroom quizzes, and interactive events with instant scoring and leaderboards.",

  keywords: [
    "kahoot alternative",
    "kahoot competitor",
    "open source kahoot alternative",
    "real-time quiz platform",
    "multiplayer quiz app",
    "online quiz competition",
    "live classroom quiz tool",
    "interactive quiz software",
    "quiz up alternative",
    "1v1 quiz platform",
    "1v1 quiz app",
    "quiz battles",
    "Buzrr",
  ],

  applicationName: "Buzrr",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: baseUrl,
  },

  openGraph: {
    type: "website",
    url: baseUrl,
    siteName: "Buzrr",
    title:
      "Buzrr - The Best Open Source Kahoot Alternative for Live Multiplayer Quizzes",
    description:
      "Host real-time quizzes with instant scoring, live leaderboards, and multiplayer gameplay. Built for classrooms, workshops, and competitive quiz events.",
    images: [
      {
        url: `${baseUrl}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Buzrr - Open Source Kahoot Alternative",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title:
      "Buzrr - Open Source Kahoot Alternative for Real-Time Multiplayer Quizzes",
    description:
      "Run engaging live quiz competitions with real-time multiplayer gameplay.",
    images: [`${baseUrl}/opengraph-image.png`],
  },

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
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
        className={clsx(sans.className, "bg-light-bg dark:bg-dark-bg h-fit overflow-x-hidden")}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Buzrr",
              applicationCategory: "GameApplication",
              operatingSystem: "Web",
              description:
                "Buzrr is a powerful open source Kahoot alternative for hosting real-time multiplayer quizzes and hosting 1v1 quiz battles. Run live competitions, classroom quizzes, and interactive events with instant scoring and leaderboards.",
              url: baseUrl,
            }),
          }}
        />
        <ReduxProvider>
          {children}
          <Footer />
        </ReduxProvider>
      </body>
    </html>
  );
}