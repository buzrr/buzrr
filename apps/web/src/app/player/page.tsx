"use client";
import { useState } from "react";
import CheckLocalPlayer from "@/components/Player/CheckLocalPlayer";
import CreatePlayerForm from "@/components/Player/Setup/CreatePlayerForm";
import JoinShell from "@/components/Player/Setup/JoinShell";
import ProfilePreview from "@/components/Player/Setup/ProfilePreview";
import { PROFILES } from "@/components/Player/SelectProfile";

function Player() {
  const [data, setData] = useState({
    name: "",
    image: PROFILES[0],
  });

  return (
    <>
      <CheckLocalPlayer />
      <JoinShell
        form={<CreatePlayerForm data={data} setData={setData} />}
        preview={<ProfilePreview name={data.name} image={data.image} />}
      />
    </>
  );
}

export default Player;
