import Link from "next/link";
import ClientImage from "@/components/ClientImage";

export default function Home() {
  return (
    <>
      <div className="p-2 px-4 md:px-8 bg-light-bg dark:bg-dark-bg">
        <Link href="/">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzzr Logo",
              width: 80,
              height: 80,
            }}
          />
        </Link>
      </div>
      <div className="flex justify-start items-center gap-x-4 *:h-[80vh] *:rounded-xl *:bg-white *:dark:bg-dark p-4 md:px-8">
        <div className="flex flex-col w-full md:w-[55vw] p-10">
          <h1 className="text-dark dark:text-white text-3xl text-center md:text-start md:text-6xl font-black my-6">
            Buzz In for a Brain Workout
          </h1>
          <p className="text-sm text-center md:text-start text-dark dark:text-white my-4">
            Press play to join rooms
          </p>
          <Link
            href="/player"
            className="p-2 md:px-16 mt-20 md:mt-4 mx-auto md:mx-0 w-[80%] block md:w-[65%] text-lg font-black text-center bg-lprimary dark:bg-dprimary text-white dark:text-dark rounded-lg"
          >
            PLAY
          </Link>
          <Link
            href="/admin"
            className="w-fit text-sm mt-auto self-center text-lprimary dark:text-dprimary font-bold"
          >
            Create a quiz
          </Link>
        </div>
        <div className="w-[40vw] hidden md:flex justify-center items-center">
          <ClientImage
            props={{
              src: "/images/landing-page.svg",
              darksrc: "/images/landing-page-dark.svg",
              alt: "Buzzr Logo",
              width: 350,
              height: 350,
            }}
          />
        </div>
      </div>
    </>
  );
}
