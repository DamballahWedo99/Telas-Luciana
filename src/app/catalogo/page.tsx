import { Suspense } from "react";
import CatalogoContent from "@/components/CatalogoContent";

export default function Catalogo() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-pulse text-[#174CA7] text-xl">
            Cargando...
          </div>
        </div>
      }
    >
      <CatalogoContent />
    </Suspense>
  );
}
