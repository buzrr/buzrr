"use client";
import { useAppSelector, useAppDispatch } from "@/state/hooks";
import { NavToggle, setNavToggle } from "@/state/admin/navtoggleSlice";
import { IconButton } from "@/components/ui/IconButton";

const NavbarToggle = () => {
  const toggle = useAppSelector((state) => state.navToggle.toggle);
  const dispatch = useAppDispatch();

  return (
    <>
      <IconButton
        aria-label="Toggle navigation"
        className="text-dark dark:text-white"
        onClick={() => {
          dispatch(
            setNavToggle(
              toggle === NavToggle.collapse
                ? NavToggle.expand
                : NavToggle.collapse,
            ),
          );
        }}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        }
      />
    </>
  );
};

export default NavbarToggle;
