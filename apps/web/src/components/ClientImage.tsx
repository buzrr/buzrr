"use client";
import clsx from "clsx";
import Image from "next/image";
import { PageTheme } from "@/state/pageThemeSlice";
import { useRenderedTheme } from "@/hooks/useRenderedTheme";

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
  const theme = useRenderedTheme();

  return (
    <>
      <Image
        src={theme === PageTheme.light ? props.src : props.darksrc || props.src}
        alt={props.alt}
        width={props.width}
        height={props.height}
        className={clsx(props.classname, "inline")}
      />
    </>
  );
};

export default ClientImage;
