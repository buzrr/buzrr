"use client";

import CreateBuzrrForm from "@/components/Admin/Home/CreateBuzrrForm";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaArrowLeft } from "react-icons/fa";

export default function CreateQuiz() {
  const profiles = [
    { image: "/images/player_profile/profile1.png", name: "LesgooVroomVroom" },
    { image: "/images/player_profile/profile2.png", name: "SayItLoudlyBro" },
    { image: "/images/player_profile/profile3.png", name: "AlanOP" },
    { image: "/images/player_profile/profile4.png", name: "TuHaiKaaliya" },
    { image: "/images/player_profile/profile5.jpg", name: "Sanika" },
    { image: "/images/player_profile/profile6.png", name: "Pikachu" },
    { image: "/images/player_profile/profile7.jpg", name: "LakshayBansal" },
    { image: "/images/player_profile/profile9.jpg", name: "Deadass" },
    { image: "/images/player_profile/profile10.jpg", name: "HarshPanchal" },
    { image: "/images/player_profile/profile11.jpg", name: "Jack" },
    { image: "/images/player_profile/profile12.png", name: "KavitaYadav" },
  ];

  const router = useRouter();

  function handleBack() {
    router.push("/admin");
  }

  const [title, setTitle] = useState("");
  return (
    <>
      <div className="md:mx-8 my-6 md:max-h-[84vh] h-[84vh]">
        <div className="flex md:px-8 bg-white dark:bg-dark rounded-lg w-full overflow-y-auto m-auto py-4 h-full">
          <div className="mt-4 w-full md:w-1/2 px-4 sm:px-8 md:px-0 flex flex-col bg-white dark:bg-dark">
            <p
              className="cursor-pointer flex items-center dark:text-white"
              onClick={handleBack}
            >
              <FaArrowLeft className="inline mr-1" />
              Back to home
            </p>
            <p className="mt-4 dark:text-white leading-[40px] sm:leading-[48px] md:leading-[56px] text-3xl sm:text-4xl md:text-5xl font-extrabold">
              Give your quiz title
              <br /> and description
            </p>
            <CreateBuzrrForm setTitle={setTitle} />
          </div>
          <div className=" mt-4 w-1/2 bg-light-bg dark:bg-dark-bg p-8 rounded-3xl hidden md:block">
            <p className="text-3xl italic font-extrabold dark:text-white mb-6 w-11/12">
              {title ? title : "Quiz Title"}
            </p>
            <div className="flex flex-row gap-4 flex-wrap">
              {profiles.map((file, index) => {
                return (
                  <div
                    key={index}
                    className="border flex justify-between items-center w-fit gap-2 rounded-full p-2 bg-off-white dark:bg-off-dark text-dark dark:text-white text-lg"
                  >
                    <Image
                      src={`${file.image}`}
                      width={50}
                      height={50}
                      alt="Profile"
                      className="rounded-full h-8 w-8"
                    />
                    {file.name}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
