import React from "react";
import ClientImage from "../ClientImage";

const SplitWrapper = (props: {
  sideImage: string;
  sideImageDark: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="min-h-[85vh] flex justify-center lg:justify-around items-center">
      <div className="hidden lg:block">
        <ClientImage
          props={{
            src: props.sideImage,
            darksrc: props.sideImageDark,
            alt: "Side Placeholder Image",
            width: 450,
            height: 450,
          }}
        />
      </div>
      {props.children}
    </div>
  );
};

export default SplitWrapper;
