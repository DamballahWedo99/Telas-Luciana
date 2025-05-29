import React, { useState, useEffect } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ClockIcon,
  RefreshCwIcon,
  DollarSignIcon,
  EyeIcon,
  Loader2Icon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react";
import { InventoryItem } from "../../../types/types";

interface PendingFabric {
  id: string;
  tela: string;
  color: string;
  cantidad: number;
  unidades: string;
  oc?: string;
  costo: number | null;
}

interface PendingFile {
  fileName: string;
  uploadId: string;
  originalName: string;
  processedAt: string;
  fabrics: PendingFabric[];
  totalFabrics: number;
}

interface PendingFabricsCardProps {
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  isAdmin: boolean;
}

export const PendingFabricsCard: React.FC<PendingFabricsCardProps> = ({
  setInventory,
  isAdmin,
}) => {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PendingFile | null>(null);
  const [showCostsDialog, setShowCostsDialog] = useState(false);
  const [fabricsWithCosts, setFabricsWithCosts] = useState<PendingFabric[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Función para verificar archivos pending
  const checkPendingFiles = async () => {
    if (!isAdmin) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/packing-list/check-pending");

      if (!response.ok) {
        throw new Error("Error al verificar archivos pending");
      }

      const data = await response.json();
      setPendingFiles(data.pendingFiles || []);
      setLastCheck(new Date());

      if (data.hasPendingFiles) {
        console.log(
          `Se encontraron ${data.totalPendingFiles} archivos pending`
        );
      }
    } catch (error) {
      console.error("Error verificando archivos pending:", error);
      toast.error("Error al verificar archivos pending");
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar archivos pending al montar el componente
  useEffect(() => {
    checkPendingFiles();

    // Configurar verificación automática cada 30 segundos
    const interval = setInterval(() => {
      checkPendingFiles();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Fecha inválida";
    }
  };

  // Abrir modal para asignar costos
  const handleAssignCosts = (file: PendingFile) => {
    setSelectedFile(file);
    setFabricsWithCosts([...file.fabrics]);
    setShowCostsDialog(true);
  };

  // Manejar cambio de costo para una tela específica
  const handleCostChange = (fabricId: string, cost: string) => {
    const costValue = cost.trim() === "" ? null : parseFloat(cost);

    setFabricsWithCosts((prevFabrics) =>
      prevFabrics.map((fabric) =>
        fabric.id === fabricId ? { ...fabric, costo: costValue } : fabric
      )
    );
  };

  // Validar que todas las telas tengan costos
  const validateCosts = (): boolean => {
    const missingCosts = fabricsWithCosts.some(
      (fabric) => fabric.costo === null
    );
    if (missingCosts) {
      toast.error("Por favor, ingresa un costo para todas las telas");
      return false;
    }
    return true;
  };

  // Guardar costos y actualizar inventario
  const handleSaveCosts = async () => {
    if (!validateCosts() || !selectedFile) return;

    setIsProcessing(true);
    try {
      // Enviar las telas con costos para guardar en el inventario
      const response = await fetch("/api/packing-list/save-costs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fabrics: fabricsWithCosts,
          fileName: selectedFile.fileName,
          uploadId: selectedFile.uploadId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar los costos");
      }

      const result = await response.json();

      // Actualizar el inventario local con los nuevos ítems
      setInventory((prevInventory) => [
        ...prevInventory,
        ...result.inventoryItems,
      ]);

      // Cerrar modal y actualizar lista de archivos pending
      setShowCostsDialog(false);
      setSelectedFile(null);

      toast.success(
        `${result.inventoryItems.length} telas agregadas al inventario`
      );

      // Recargar archivos pending
      checkPendingFiles();
    } catch (error) {
      console.error("Error al guardar costos:", error);
      toast.error("Error al guardar los costos y actualizar el inventario");
    } finally {
      setIsProcessing(false);
    }
  };

  // No mostrar el componente si no es admin
  if (!isAdmin) {
    return null;
  }

  // No mostrar si no hay archivos pending
  if (pendingFiles.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="mb-6 border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ClockIcon className="mr-2 h-5 w-5 text-orange-600" />
              <div>
                <CardTitle className="text-orange-800">
                  Telas Pendientes de Asignación
                </CardTitle>
                <CardDescription className="text-orange-600">
                  {pendingFiles.length} archivo
                  {pendingFiles.length !== 1 ? "s" : ""} con telas que necesitan
                  asignación de costos
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={checkPendingFiles}
                      disabled={isLoading}
                      className="border-orange-300 hover:bg-orange-100"
                    >
                      {isLoading ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Actualizar lista</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          {lastCheck && (
            <p className="text-xs text-orange-500 mt-2">
              Última verificación: {formatDate(lastCheck.toISOString())}
            </p>
          )}
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {pendingFiles.map((file) => (
              <div
                key={file.fileName}
                className="flex items-center justify-between p-4 bg-white border border-orange-200 rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {file.originalName}
                  </h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{file.totalFabrics} telas</span>
                    <span>Procesado: {formatDate(file.processedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignCosts(file)}
                          className="flex items-center gap-2"
                        >
                          <DollarSignIcon className="h-4 w-4" />
                          Asignar Costos
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Asignar costos a las telas de este archivo</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal para asignar costos */}
      <Dialog open={showCostsDialog} onOpenChange={setShowCostsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar Costos a las Telas</DialogTitle>
            <DialogDescription>
              Archivo: {selectedFile?.originalName} -{" "}
              {selectedFile?.totalFabrics} telas detectadas
            </DialogDescription>
          </DialogHeader>

          {selectedFile && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 text-left">Tela</th>
                      <th className="py-2 px-4 text-left">Color</th>
                      <th className="py-2 px-4 text-left">Cantidad</th>
                      <th className="py-2 px-4 text-left">Unidades</th>
                      {selectedFile.fabrics.some((fabric) => fabric.oc) && (
                        <th className="py-2 px-4 text-left">OC</th>
                      )}
                      <th className="py-2 px-4 text-left">Costo Unitario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fabricsWithCosts.map((fabric) => (
                      <tr key={fabric.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4">{fabric.tela}</td>
                        <td className="py-2 px-4">{fabric.color}</td>
                        <td className="py-2 px-4">
                          {formatNumber(fabric.cantidad)}
                        </td>
                        <td className="py-2 px-4">{fabric.unidades}</td>
                        {selectedFile.fabrics.some((fabric) => fabric.oc) && (
                          <td className="py-2 px-4">{fabric.oc || "-"}</td>
                        )}
                        <td className="py-2 px-4">
                          <div className="flex items-center">
                            <span className="mr-2">$</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fabric.costo === null ? "" : fabric.costo}
                              onChange={(e) =>
                                handleCostChange(fabric.id, e.target.value)
                              }
                              placeholder="0.00"
                              className="w-full"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <AlertCircleIcon className="h-4 w-4" />
                <span>
                  Todos los costos deben ser ingresados para continuar
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCostsDialog(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCosts}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Guardar Costos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
