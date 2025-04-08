"use client";

import { Button } from "@/components/ui/button";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import Image from "next/image";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/autoplay";

const slides = [
  {
    id: 1,
    src: "/images/peluche/ML130722-6.jpg",
    alt: "Tela deportiva",
  },
  {
    id: 2,
    src: "/images/chamarras/BD042.jpg",
    alt: "Tela médica",
  },
  {
    id: 3,
    src: "/images/deportiva/LH-65-M.jpg",
    alt: "Tela para peluches",
  },
];

export function Hero({
  onExplore,
  onContact,
}: {
  onExplore: () => void;
  onContact: () => void;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-[2vw] md:gap-[8vw] lg:gap-[2vw] p-[2vw] pt-[4vh] md:pt-[4vh] lg:pt-[0vh] min-h-[80vh] max-w-[90vw] mx-auto items-center">
      <div className="space-y-[3vh] flex flex-col items-center md:items-center lg:items-start text-center md:text-center lg:text-left">
        <h1 className="text-[11vw] md:text-[8vw] lg:text-[4vw] font-bold leading-[1.1]">
          Telas que <span className="text-[#ff8737]">Inspiran</span>
          <br />
          Creaciones
        </h1>
        <p className="text-gray-600 text-[3.4vw] md:text-[2.8vw] lg:text-[1.2vw] leading-relaxed max-w-[60vw] md:max-w-[60vw] lg:max-w-[35vw]">
          Descubre nuestra colección de telas para ropa deportiva, médica,
          peluche para juguetes, chamarras y chalecos, leggins, sublimar,
          rompevientos, uniformes y producto terminado. Con más de 20 años de
          experiencia, surtimos telas de la más alta calidad a tu negocio.
        </p>
        <div className="flex flex-col sm:flex-row gap-[3vw] sm:gap-[1vw] justify-center md:justify-center lg:justify-start w-full sm:w-auto">
          <Button
            className="bg-[#174CA7] hover:bg-[#174CA7]/90 text-white px-[4vw] py-[2vh] sm:px-[2vw] sm:py-[2vh] lg:py-[3vh] text-[4vw] sm:text-[1.8vw] md:text-[2.2vw] lg:text-[1vw] w-full sm:w-auto"
            onClick={onExplore}
          >
            Explorar Telas
          </Button>
          <Button
            variant="outline"
            className="border-[#174CA7] text-[#174CA7] hover:bg-[#174CA7] hover:text-white px-[4vw] py-[2vh] sm:px-[2vw] sm:py-[2vh] lg:py-[3vh] text-[4vw] sm:text-[1.8vw] md:text-[2.2vw] lg:text-[1vw] w-full sm:w-auto"
            onClick={onContact}
          >
            Contactar
          </Button>
        </div>
      </div>
      <div className="relative h-[20vh] md:h-[30vh] lg:h-[60vh] rounded-[2vw] overflow-hidden">
        <Swiper
          modules={[Autoplay, EffectFade]}
          effect="fade"
          autoplay={{
            delay: 3500,
            disableOnInteraction: false,
          }}
          loop={true}
          className="w-full h-full"
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id}>
              <div className="relative w-full h-full">
                <Image
                  src={slide.src || "/placeholder.svg"}
                  alt={slide.alt}
                  fill
                  className="object-cover object-[0%_100%]"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
