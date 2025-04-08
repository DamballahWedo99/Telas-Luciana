import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Image from "next/image";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  altText: string;
}

export function ImageModal({
  isOpen,
  onClose,
  imageSrc,
  altText,
}: ImageModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!mounted) return null;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] h-[90vh] max-w-[1200px] max-h-[800px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white rounded-full p-2"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </button>
        <div className="relative w-full h-full rounded-lg overflow-hidden">
          <Image
            src={imageSrc}
            alt={altText}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 70vw, 1000px"
          />
        </div>
      </div>
    </div>
  );
}
