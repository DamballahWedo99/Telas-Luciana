import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { Nav } from "@/components/static/Nav";
import { Footer } from "@/components/static/Footer";
// Removed duplicate toaster import - using root layout toaster

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Telas y Tejidos Luciana",
  description:
    "Importación y proveeduría de telas para la confección de diversos tipos de prendas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <div className="w-full max-w-[90vw] mx-auto">
            <Nav />
          </div>
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
