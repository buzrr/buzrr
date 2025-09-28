import React from "react";
import ClientImage from "../ClientImage";

const SplitWrapper = (props: {
  sideImage: string;
  sideImageDark: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="md:h-[85vh] flex justify-around items-center">
      <ClientImage
        props={{
          src: props.sideImage,
          darksrc: props.sideImageDark,
          alt: "Side Placeholder Image",
          classname: "hidden md:block",
          width: 450,
          height: 450,
        }}
      />
      {props.children}
    </div>
  );
};

export default SplitWrapper;
