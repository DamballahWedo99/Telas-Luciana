import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Panel de Control | Telas y Tejidos Luciana",
  description:
    "Sistema de gestión de inventario para administrar telas, órdenes, costos y más.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main className={`${inter.className} min-h-screen flex-grow`}>
        {children}
        <Toaster />
      </main>
    </>
  );
}
