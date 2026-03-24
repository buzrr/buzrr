"use client";
import { useState } from "react";
import { toast } from "react-toastify";
import ClientImage from "@/components/ClientImage";
import { DEFAULT_AVATAR } from "@/constants";
import updatePlayerName from "@/actions/UpdatePlayerNameAction";

const JoinRoomProfileCard = (params: {
  playerId: string;
  initialPlayerName: string;
  profilePic: string | null;
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [savedPlayerName, setSavedPlayerName] = useState(params.initialPlayerName);
  const [playerName, setPlayerName] = useState(params.initialPlayerName);

  const handleNameChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "");
    const trimmed = cleaned.slice(0, 30);
    setPlayerName(trimmed);
  };

  async function savePlayerName() {
    const formData = new FormData();
    formData.append("playerId", params.playerId);
    formData.append("username", playerName);

    const result = await updatePlayerName(formData);
    if (result?.error) {
      toast.error(result.error || "Something went wrong");
      return;
    }

    setSavedPlayerName(playerName);
    setIsEditingName(false);
    toast.success("Player name updated");
  }

  return (
    <div className="w-[40vw] hidden md:flex md:flex-col items-center justify-center gap-4">
      <ClientImage
        props={{
          src: params.profilePic || DEFAULT_AVATAR,
          alt: "player avatar",
          width: 200,
          height: 200,
          classname: "rounded-full",
        }}
      />
      {!isEditingName ? (
        <div className="flex items-center gap-3">
          <p className="text-2xl font-bold dark:text-white">{savedPlayerName}</p>
          <button
            type="button"
            className="px-3 py-1 rounded-lg border border-gray dark:text-white font-bold text-sm cursor-pointer"
            onClick={() => setIsEditingName(true)}
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-2">
          <input
            type="text"
            name="username"
            placeholder="Enter Display Name"
            className="w-[70%] border-gray dark:bg-dark-bg dark:text-white border focus:border-blue-600 rounded-lg outline-none text-slate-900 px-4 py-3"
            required
            autoComplete="off"
            maxLength={30}
            value={playerName}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-lprimary dark:bg-dprimary text-white dark:text-dark font-bold cursor-pointer"
              onClick={savePlayerName}
            >
              Save
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray dark:text-white font-bold cursor-pointer"
              onClick={() => {
                setPlayerName(savedPlayerName);
                setIsEditingName(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoinRoomProfileCard;
