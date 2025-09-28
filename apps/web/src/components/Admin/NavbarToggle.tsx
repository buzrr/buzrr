"use client";
import { RootState } from "@/state/store";
import { useSelector, useDispatch } from "react-redux";
import { navToggle, setNavToggle } from "@/state/admin/navtoggleSlice";

const NavbarToggle = () => {
  const toggle = useSelector((state: RootState) => state.navToggle.toggle);
  const dispatch = useDispatch();

  return (
    <>
      <button
        className="text-dark dark:text-white p-2 rounded-md"
        onClick={() => {
          dispatch(
            setNavToggle(
              toggle === navToggle.collapse
                ? navToggle.expand
                : navToggle.collapse,
            ),
          );
        }}
      >
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
      </button>
    </>
  );
};

export default NavbarToggle;
