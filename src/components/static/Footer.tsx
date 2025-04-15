import Link from "next/link";
import { Instagram, Facebook } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-100 py-[4vh] px-[4vw] sm:py-[3vh] sm:px-[2vw]">
      <div className="max-w-[90vw] mx-auto flex flex-col sm:flex-row justify-between items-center gap-[2vh] sm:gap-0">
        <p className="text-[3vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] text-gray-600 text-center sm:text-left">
          © {new Date().getFullYear()} Telas y Tejidos Luciana. Todos los
          derechos reservados.
        </p>
        <div className="flex items-center gap-[3vw] sm:gap-[1.5vw]">
          <Link
            href="/politica-de-privacidad"
            className="text-[3vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] text-[#174CA7] hover:text-[#F1965B] transition-colors duration-300"
          >
            Política de Privacidad
          </Link>
          <div className="h-[3vh] sm:h-[2vh] w-[1px] bg-gray-300 mx-[1vw] sm:mx-[0.5vw]"></div>
          <Link
            href="https://www.instagram.com/telasytejidos/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-[#174CA7] hover:text-[#F1965B] transition-colors duration-300"
          >
            <Instagram className="w-[4vw] h-[4vw] sm:w-[1.4vw] sm:h-[1.4vw] md:w-[2.5vw] md:h-[2.5vw] lg:w-[1.4vw] lg:h-[1.4vw]" />
          </Link>
          <Link
            href="https://www.facebook.com/telasytejidosluciana/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="text-[#174CA7] hover:text-[#F1965B] transition-colors duration-300"
          >
            <Facebook className="w-[4vw] h-[4vw] sm:w-[1.4vw] sm:h-[1.4vw] md:w-[2.5vw] md:h-[2.5vw] lg:w-[1.4vw] lg:h-[1.4vw]" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
