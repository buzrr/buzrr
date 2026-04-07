"use client";
import clsx from "clsx";
import Image from "next/image";
import { useAppSelector } from "@/state/hooks";
import { PageTheme } from "@/state/pageThemeSlice";

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
  const theme = useAppSelector((state) => state.pageTheme.theme);

  return (
    <>
      <Image
        src={`${theme === PageTheme.light ? props.src : props.darksrc || props.src}`}
        alt={props.alt}
        width={props.width}
        height={props.height}
        className={clsx(props.classname, "inline")}
      />
    </>
  );
};

export default ClientImage;
