import "../globals.css";
import "./styles.css";
import ToastViewport from "@/components/ToastViewport";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col h-full">
      {children}
      <ToastViewport />
    </div>
  );
}
