import React, { useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileUploading: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  handleFileUpload,
  fileUploading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="bg-white p-8 rounded shadow-sm flex flex-col items-center justify-center">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 mb-4 text-center">{description}</p>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv"
        className="hidden"
      />
      <Button
        onClick={triggerFileUpload}
        disabled={fileUploading}
        className="flex items-center gap-2"
      >
        {fileUploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando archivo...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Seleccionar archivo CSV
          </>
        )}
      </Button>
    </div>
  );
};
