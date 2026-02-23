"use client";
import clsx from "clsx";
import Image from "next/image";
import { useSelector } from "react-redux";
import { pageTheme } from "@/state/pageThemeSlice";
import { RootState } from "@/state/store";

const ClientImage = ({
  props,
}: {
  props: {
    src: string;
    darksrc?: string;
    alt: string;
    width: number;
    height: number;
    classname?: string;
  };
}) => {
  const theme = useSelector((state: RootState) => state.pageTheme.theme);

  return (
    <>
      <Image
        src={`${theme === pageTheme.light ? props.src : props.darksrc || props.src}`}
        alt={props.alt}
        width={props.width}
        height={props.height}
        className={clsx(props.classname, "inline")}
      />
    </>
  );
};

export default ClientImage;
