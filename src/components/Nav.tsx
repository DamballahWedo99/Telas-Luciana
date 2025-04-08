import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SearchComponent } from "@/components/SearchComponent";
import { MobileMenu } from "@/components/MobileMenu";

export function Nav() {
  return (
    <nav className="flex items-center justify-between p-[4vw] md:p-[2vw] md:pt-[4vw] lg:pt-[2vw] max-w-[90vw] mx-auto">
      <Link
        href="/"
        className="flex items-center gap-[1vw] md:gap-[2vw] lg:gap-[1vw]"
      >
        <Image
          src="/images/logo.svg"
          alt="Logo"
          width={300}
          height={100}
          className="w-[35vw] md:w-[20vw] lg:w-[12vw]"
        />
      </Link>

      <div className="flex items-center gap-[3vw] md:gap-[2vw]">
        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-[2vw]">
          <SearchComponent />
          <Link href="/catalogo">
            <Button
              variant="outline"
              className="border-[#174CA7] text-[#174CA7] hover:bg-[#174CA7] hover:text-white text-[2vw] lg:text-[1vw] px-[3vw] lg:px-[2vw] py-[2vh] lg:py-[2.5vh]"
            >
              Catálogo
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger menu */}
        <MobileMenu />
      </div>
    </nav>
  );
}
