import Navbar from "@/components/Admin/Navbar";
import HistoryClient from "@/components/Admin/History/HistoryClient";

export default function Page() {
  return (
    <div className="flex">
      <Navbar />
      <div className="w-full md:w-[75%]">
        <HistoryClient />
      </div>
    </div>
  );
}
