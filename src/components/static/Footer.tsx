import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-100 py-[4vh] px-[4vw] sm:py-[3vh] sm:px-[2vw]">
      <div className="max-w-[90vw] mx-auto flex flex-col sm:flex-row justify-between items-center gap-[2vh] sm:gap-0">
        <p className="text-[3vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] text-gray-600 text-center sm:text-left">
          © {new Date().getFullYear()} Telas y Tejidos Luciana. Todos los
          derechos reservados.
        </p>
        <Link
          href="/politica-de-privacidad"
          className="text-[3vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] text-[#174CA7] hover:text-[#F1965B] transition-colors duration-300"
        >
          Política de Privacidad
        </Link>
      </div>
    </footer>
  );
}
