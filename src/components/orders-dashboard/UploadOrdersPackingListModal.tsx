import React, { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2Icon,
  UploadIcon,
  FolderOpenIcon,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UploadResult {
  uploadId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileUrl: string;
}

interface UploadOrdersPackingListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadOrdersPackingListModal: React.FC<UploadOrdersPackingListModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleClose = () => {
    setUploadResult(null);
    onClose();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Por favor, selecciona un archivo de Excel (.xlsx o .xls)");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("El archivo es demasiado grande. Tamaño máximo: 10MB");
      return;
    }

    handlePackingListUpload(file);
  };

  const handlePackingListUpload = async (file: File) => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/orders/upload-orders", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al subir la Orden de Compra");
      }

      const result = await response.json();
      setUploadResult(result);

      toast.success("Archivo subido correctamente al bucket S3");

      console.log("🚀 [UploadOrdersPackingListModal] Disparando evento orders-uploaded");
      const event = new CustomEvent("orders-uploaded", {
        detail: {
          fileName: file.name,
          uploadId: result.uploadId,
          uploadedAt: new Date().toISOString(),
          result: result,
        },
      });

      window.dispatchEvent(event);
      console.log(
        "✅ [UploadOrdersPackingListModal] Evento orders-uploaded disparado exitosamente"
      );

      // Iniciar polling después de 3 segundos
      setTimeout(() => {
        console.log("🔄 [UploadOrdersPackingListModal] Iniciando polling para verificar procesamiento...");
        window.dispatchEvent(new CustomEvent("start-orders-polling"));
      }, 3000);
    } catch (error) {
      console.error("Error al subir ORDEN DE COMPRA:", error);
      toast.error(
        typeof error === "object" && error !== null && "message" in error
          ? (error as Error).message
          : "Error al subir el archivo de Orden de Compra"
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">+</span>
            Subir Orden de Compra
          </DialogTitle>
          <DialogDescription>
            Sube un archivo de orden de compra para procesar información de pedidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <FolderOpenIcon className="h-12 w-12 text-gray-400 mb-4" />
            <p className="mb-4 text-sm text-gray-500 text-center">
              Selecciona un archivo Excel con la información de la Orden de Compra
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".xlsx,.xls"
            />
            <Button
              onClick={handleUploadClick}
              disabled={isUploading}
              className="flex items-center mb-4"
            >
              {isUploading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Seleccionar Archivo
                </>
              )}
            </Button>
            <p className="text-xs text-gray-400">
              Formatos soportados: .xlsx, .xls (máximo 10MB)
            </p>
          </div>

          {uploadResult && (
            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <h3 className="text-sm font-medium text-green-800">
                  Archivo cargado exitosamente
                </h3>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p>
                  <strong>Archivo:</strong> {uploadResult.originalName}
                </p>
                <p>
                  <strong>Tamaño:</strong>{" "}
                  {formatFileSize(uploadResult.fileSize)}
                </p>
                <p>
                  <strong>ID de carga:</strong> {uploadResult.uploadId}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            {uploadResult ? "Cerrar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};