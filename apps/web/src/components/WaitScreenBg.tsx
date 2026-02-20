import Image from "next/image";

export default function WaitScreen() {
  return (
    <>
      <div className="w-screen h-fit md:h-screen bg-[#7D49F8] absolute">
        <div className="grid grid-cols-4">
          <div className="flex flex-col gap-y-6">
            <div className="bg-white p-3 rounded-b-xl">
              <p className="font-bold text-lg">
                What is the name of this Platform?
              </p>
              <div className="cursor-pointer p-3 rounded-xl text-lg dark:text-white mt-4 dark:bg-dprimary bg-lprimary">
                1. Buzzer
              </div>
              <div className="cursor-pointer p-3 rounded-xl text-lg dark:text-white mt-4 dark:bg-dprimary bg-lprimary">
                2. Buzzr
              </div>
              <div className="cursor-pointer p-3 rounded-xl text-lg dark:text-white mt-4 dark:bg-dprimary bg-lprimary">
                3. Kahoot
              </div>
              <div className="cursor-pointer p-3 rounded-xl text-lg dark:text-white mt-4 dark:bg-dprimary bg-lprimary">
                4. Option 4
              </div>
            </div>

            <div className="bg-white p-3 rounded-t-xl">
              <p className="font-bold text-lg mb-4">Thank you for joining</p>
              <div className="flex items-center w-full py-2 px-6 bg-white rounded-lg border">
                <span className="text-xl mr-3">1</span>
                <div className="flex flex-row items-center gap-x-2 z-20">
                  <Image
                    src={"/avatar-1577909_1280.webp"}
                    className="w-8 h-8 rounded-full"
                    width={50}
                    height={50}
                    alt="profile pic"
                  />
                  <p>Player 1</p>
                </div>
                <p className="ml-auto">124</p>
              </div>
              <div className="flex items-center w-full py-2 px-6 bg-white rounded-lg">
                <span className="text-3xl mr-3">2</span>
                <div className="flex flex-row items-center gap-x-2 z-20">
                  <Image
                    src={"/avatar-1577909_1280.webp"}
                    className="w-12 h-12 rounded-full"
                    width={50}
                    height={50}
                    alt="profile pic"
                  />
                  <p>Player 2</p>
                </div>
                <p className="ml-auto">124</p>
              </div>
              <div className="flex items-center w-full py-2 px-6 bg-white rounded-lg">
                <span className="text-3xl mr-3">3</span>
                <div className="flex flex-row items-center gap-x-2 z-20">
                  <Image
                    src={"/avatar-1577909_1280.webp"}
                    className="w-12 h-12 rounded-full"
                    width={50}
                    height={50}
                    alt="profile pic"
                  />
                  <p>Player 3</p>
                </div>
                <p className="ml-auto">124</p>
              </div>
            </div>
          </div>
          <div className="col-span-2"></div>
          <div></div>
        </div>
      </div>
    </>
  );
}
