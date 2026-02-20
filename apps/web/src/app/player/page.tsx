"use client";
import CheckLocalPlayer from "@/components/Player/checkLocalPlayer";
import CreatePlayerForm from "@/components/Player/Setup/CreatePlayerForm";
import ClientImage from "@/components/ClientImage";
import Image from "next/image";
import { useState } from "react";
import BackNavButton from "@/components/BackNavButton";

function Player() {
  const [data, setData] = useState({
    name: "",
    err: false,
    image: "",
  });

  return (
    <>
      <CheckLocalPlayer />
      <div className="p-4 flex justify-between">
        <ClientImage
          props={{
            src: "/images/logo.svg",
            darksrc: "/images/logo-dark.svg",
            alt: "Buzzr Logo",
            width: 80,
            height: 80,
          }}
        />
      </div>
      <div className="w-full h-[81vh] flex gap-4 px-4 *:bg-white dark:*:bg-dark *:rounded-xl">
        <div className="w-[95vw] mx-auto md:mx-0 md:w-[60vw]">
          <BackNavButton />
          <CreatePlayerForm data={data} setData={setData} />
        </div>
        <div className="w-[40vw] hidden md:flex justify-center items-center">
          <div className="flex flex-col justify-center items-center">
            <ClientImage
              props={{
                src: "/images/top-cards.svg",
                darksrc: "/images/top-cards-dark.svg",
                alt: "Top Card",
                width: 350,
                height: 350,
              }}
            />
            <div className="flex items-center w-[105%] my-2 p-1 px-2 border dark:border-white rounded-lg">
              <span className="text-lg font-bold mr-2 text-dark dark:text-white">
                2<sup>nd</sup>
              </span>
              <Image
                src={`${data?.image ? data.image : "/images/player_profile/profile1.png"}`}
                alt="Card 2"
                width={50}
                height={50}
                className="rounded-full"
              />
              <span className="mx-3 font-bold text-dark dark:text-white">
                {data.name ? data.name : "Your Name"}
              </span>
              <span className="mx-1 ml-auto text-off-dark dark:text-off-white">
                1250 pt.
              </span>
            </div>
            <ClientImage
              props={{
                src: "/images/bottom-cards.svg",
                darksrc: "/images/bottom-cards-dark.svg",
                alt: "Top Card",
                width: 350,
                height: 350,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default Player;
