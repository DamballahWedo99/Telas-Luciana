import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, LayoutGrid, MoveHorizontal, Scale } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageModal } from "@/components/ImageModal";

type FabricProps = {
  id: number;
  name: string;
  image: string;
  specs?: {
    composition: string;
    width?: string;
    weight?: string;
  };
};

function FabricCard({ fabric }: { fabric: FabricProps }) {
  const [showSpecs, setShowSpecs] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  const openModal = () => {
    if (!showSpecs) {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <Card key={fabric.id} className="flex flex-col bg-[#174ca7d3]">
        <CardHeader className="flex flex-row items-center justify-between py-2 md:py-4 lg:py-6">
          <CardTitle className="text-[5vw] md:text-[2.5vw] lg:text-[1.5vw] text-white">
            {fabric.name}
          </CardTitle>
          {isDesktop ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSpecs(!showSpecs)}
                    aria-label={
                      showSpecs
                        ? "Ocultar especificaciones"
                        : "Mostrar especificaciones"
                    }
                    className="p-1 hover:bg-[#174CA7]/20"
                  >
                    {showSpecs ? (
                      <EyeOff
                        color="white"
                        className="w-[4vw] h-[4vw] md:w-[2.5vw] md:h-[2.5vw] lg:w-[1.5vw] lg:h-[1.5vw]"
                      />
                    ) : (
                      <Eye
                        color="white"
                        className="w-[4vw] h-[4vw] md:w-[2.5vw] md:h-[2.5vw] lg:w-[1.5vw] lg:h-[1.5vw]"
                      />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[0.8vw] md:text-[1.3vw] lg:text-[0.8vw]">
                    {showSpecs
                      ? "Ocultar especificaciones"
                      : "Ver especificaciones"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSpecs(!showSpecs)}
              aria-label={
                showSpecs
                  ? "Ocultar especificaciones"
                  : "Mostrar especificaciones"
              }
              className="p-1 hover:bg-[#174CA7]/20"
            >
              {showSpecs ? (
                <EyeOff
                  color="white"
                  className="w-[4vw] h-[4vw] md:w-[2.5vw] md:h-[2.5vw] lg:w-[1.5vw] lg:h-[1.5vw]"
                />
              ) : (
                <Eye
                  color="white"
                  className="w-[4vw] h-[4vw] md:w-[2.5vw] md:h-[2.5vw] lg:w-[1.5vw] lg:h-[1.5vw]"
                />
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-grow">
          {showSpecs ? (
            <div className="grid gap-[3vh] sm:gap-[2vh] md:gap-[3vh] p-[4vw] sm:p-[1vw] md:p-[2vw] bg-gray-50 rounded-lg">
              <div className="grid grid-cols-[auto,1fr] gap-[2vw] sm:gap-[1vw] items-center border-b pb-[2vh] sm:pb-[1vh]">
                <div className="flex items-center gap-[2vw] sm:gap-[0.5vw] md:gap-[1vw] font-semibold text-[3.5vw] sm:text-[1vw] md:text-[1.8vw] lg:text-[1vw] text-[#174CA7]">
                  <LayoutGrid className="w-[4vw] h-[4vw] sm:w-[1.2vw] sm:h-[1.2vw] md:w-[2vw] md:h-[2vw] lg:w-[1.2vw] lg:h-[1.2vw]" />
                  COMPOSICIÓN
                </div>
                <div className="text-[3vw] sm:text-[0.8vw] md:text-[1.5vw] lg:text-[0.8vw]">
                  {fabric.specs?.composition || "N/A"}
                </div>
              </div>
              <div className="grid grid-cols-[auto,1fr] gap-[2vw] sm:gap-[1vw] items-center border-b pb-[2vh] sm:pb-[1vh]">
                <div className="flex items-center gap-[2vw] sm:gap-[0.5vw] md:gap-[1vw] font-semibold text-[3.5vw] sm:text-[1vw] md:text-[1.8vw] lg:text-[1vw] text-[#174CA7]">
                  <MoveHorizontal className="w-[4vw] h-[4vw] sm:w-[1.2vw] sm:h-[1.2vw] md:w-[2vw] md:h-[2vw] lg:w-[1.2vw] lg:h-[1.2vw]" />
                  ANCHO
                </div>
                <div className="text-[3vw] sm:text-[0.8vw] md:text-[1.5vw] lg:text-[0.8vw]">
                  {fabric.specs?.width || "N/A"}
                </div>
              </div>
              <div className="grid grid-cols-[auto,1fr] gap-[2vw] sm:gap-[1vw] items-center">
                <div className="flex items-center gap-[2vw] sm:gap-[0.5vw] md:gap-[1vw] font-semibold text-[3.5vw] sm:text-[1vw] md:text-[1.8vw] lg:text-[1vw] text-[#174CA7]">
                  <Scale className="w-[4vw] h-[4vw] sm:w-[1.2vw] sm:h-[1.2vw] md:w-[2vw] md:h-[2vw] lg:w-[1.2vw] lg:h-[1.2vw]" />
                  PESO
                </div>
                <div className="text-[3vw] sm:text-[0.8vw] md:text-[1.5vw] lg:text-[0.8vw]">
                  {fabric.specs?.weight || "N/A"}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="relative w-full lg:h-[30vh] md:h-[20vh] h-[30vh] cursor-pointer"
              onClick={openModal}
            >
              <Image
                src={fabric.image || "/placeholder.svg"}
                alt={fabric.name}
                fill
                className="object-cover object-[0%_100%] md:object-center rounded-md"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageSrc={fabric.image}
        altText={fabric.name}
      />
    </>
  );
}

export default FabricCard;
