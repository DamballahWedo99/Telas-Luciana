import React, { useState, useEffect, useCallback, useRef } from "react";
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
  fileName?: string;
}

interface PendingFile {
  fileName: string;
  uploadId: string;
  originalName: string;
  processedAt: string;
  fabrics: PendingFabric[];
  totalFabrics: number;
}

interface GroupedByOC {
  oc: string;
  fabrics: PendingFabric[];
  totalFabrics: number;
  fileNames: string[];
  processedAt: string;
}

interface PendingFabricsCardProps {
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  isAdmin: boolean;
}

export const PendingFabricsCard: React.FC<PendingFabricsCardProps> = ({
  setInventory,
  isAdmin,
}) => {
  const [groupedByOC, setGroupedByOC] = useState<GroupedByOC[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOCGroup, setSelectedOCGroup] = useState<GroupedByOC | null>(
    null
  );
  const [showCostsDialog, setShowCostsDialog] = useState(false);
  const [fabricsWithCosts, setFabricsWithCosts] = useState<PendingFabric[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const initialCheckRef = useRef(false);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const groupFilesByOC = (files: PendingFile[]): GroupedByOC[] => {
    const grouped: Record<string, GroupedByOC> = {};

    files.forEach((file) => {
      file.fabrics.forEach((fabric) => {
        const oc = fabric.oc || "SIN_OC";

        if (!grouped[oc]) {
          grouped[oc] = {
            oc: oc,
            fabrics: [],
            totalFabrics: 0,
            fileNames: [],
            processedAt: file.processedAt,
          };
        }

        const fabricWithFile = {
          ...fabric,
          fileName: file.fileName,
        };

        grouped[oc].fabrics.push(fabricWithFile);
        grouped[oc].totalFabrics++;

        if (!grouped[oc].fileNames.includes(file.fileName)) {
          grouped[oc].fileNames.push(file.fileName);
        }

        if (new Date(file.processedAt) > new Date(grouped[oc].processedAt)) {
          grouped[oc].processedAt = file.processedAt;
        }
      });
    });

    return Object.values(grouped).sort((a, b) => a.oc.localeCompare(b.oc));
  };

  const checkPendingFiles = useCallback(async () => {
    if (!isAdmin) return;

    console.log("🔍 [PendingFabricsCard] Verificando archivos pending...");
    setIsLoading(true);

    try {
      const response = await fetch("/api/packing-list/check-pending");

      if (!response.ok) {
        throw new Error("Error al verificar archivos pending");
      }

      const data = await response.json();
      console.log("📊 [PendingFabricsCard] Respuesta recibida:", data);

      const grouped = groupFilesByOC(data.pendingFiles || []);
      setGroupedByOC(grouped);

      setLastCheck(new Date());

      if (data.hasPendingFiles) {
        console.log(
          `✅ [PendingFabricsCard] Se encontraron ${data.totalPendingFiles} archivos pending agrupados en ${grouped.length} OCs`
        );
      } else {
        console.log("✅ [PendingFabricsCard] No hay archivos pending");
      }
    } catch (error) {
      console.error(
        "❌ [PendingFabricsCard] Error verificando archivos pending:",
        error
      );
      toast.error("Error al verificar archivos pending");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  const pollForPendingFiles = useCallback(
    async (
      fileName: string,
      maxAttempts: number = 3,
      delayMs: number = 5000
    ) => {
      console.log(
        `🔄 [PendingFabricsCard] Iniciando polling para ${fileName} (${maxAttempts} intentos, delay ${delayMs}ms)`
      );

      let attempt = 1;

      const poll = async (): Promise<void> => {
        try {
          console.log(
            `📡 [PendingFabricsCard] Intento ${attempt}/${maxAttempts} - Verificando archivos pending...`
          );

          if (attempt === 1) {
            toast.info(
              `🔄 Procesando ${fileName}... (Intento ${attempt}/${maxAttempts})`,
              {
                duration: delayMs - 500,
              }
            );
          } else {
            toast.info(
              `🔄 Reintentando... (Intento ${attempt}/${maxAttempts})`,
              {
                duration: delayMs - 500,
              }
            );
          }

          const response = await fetch("/api/packing-list/check-pending");

          if (!response.ok) {
            throw new Error("Error al verificar archivos pending");
          }

          const data = await response.json();
          console.log(
            `📊 [PendingFabricsCard] Intento ${attempt} - Respuesta:`,
            {
              hasPendingFiles: data.hasPendingFiles,
              totalPendingFiles: data.totalPendingFiles,
              totalPendingFabrics: data.totalPendingFabrics,
            }
          );

          if (data.hasPendingFiles && data.totalPendingFabrics > 0) {
            console.log(
              `✅ [PendingFabricsCard] ¡Éxito en intento ${attempt}! Archivos pending encontrados`
            );

            const grouped = groupFilesByOC(data.pendingFiles || []);
            setGroupedByOC(grouped);
            setLastCheck(new Date());

            toast.success(
              `✅ ${fileName} procesado exitosamente - ${data.totalPendingFabrics} telas encontradas`,
              {
                duration: 5000,
              }
            );

            return;
          }

          if (attempt >= maxAttempts) {
            console.error(
              `❌ [PendingFabricsCard] Polling fallido después de ${maxAttempts} intentos`
            );

            toast.error(`❌ Error procesando ${fileName}`, {
              description: `Lambda no procesó el archivo después de ${maxAttempts} intentos. Intenta subir el archivo nuevamente.`,
              duration: 10000,
            });

            return;
          }

          attempt++;
          console.log(
            `⏳ [PendingFabricsCard] Esperando ${delayMs}ms antes del próximo intento...`
          );

          setTimeout(() => {
            poll();
          }, delayMs);
        } catch (error) {
          console.error(
            `❌ [PendingFabricsCard] Error en intento ${attempt}:`,
            error
          );

          if (attempt >= maxAttempts) {
            toast.error(
              `❌ Error verificando archivos pending para ${fileName}`,
              {
                description: `Falló después de ${maxAttempts} intentos. Verifica la conexión o intenta de nuevo.`,
                duration: 10000,
              }
            );
            return;
          }

          attempt++;
          setTimeout(() => {
            poll();
          }, delayMs);
        }
      };

      await poll();
    },
    []
  );

  useEffect(() => {
    if (!isAdmin || initialCheckRef.current) return;

    console.log(
      "🔧 [PendingFabricsCard] TRIGGER 1: Carga inicial del Dashboard"
    );
    initialCheckRef.current = true;
    checkPendingFiles();

    console.log(
      "✅ [PendingFabricsCard] Verificación automática DESACTIVADA para evitar archivos vacíos"
    );
  }, [isAdmin, checkPendingFiles]);

  useEffect(() => {
    const handlePackingListEvent = async (event: Event) => {
      console.log(
        "🔧 [PendingFabricsCard] TRIGGER 4: Detectado packing list subido"
      );

      const customEvent = event as CustomEvent<{ fileName?: string }>;
      const fileName = customEvent.detail?.fileName || "archivo desconocido";

      await pollForPendingFiles(fileName);
    };

    window.addEventListener("packing-list-uploaded", handlePackingListEvent);

    return () => {
      window.removeEventListener(
        "packing-list-uploaded",
        handlePackingListEvent
      );
    };
  }, [pollForPendingFiles]);

  const handleManualRefresh = () => {
    console.log(
      "🔧 [PendingFabricsCard] TRIGGER 2: Actualización manual por admin"
    );
    checkPendingFiles();
  };

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

  const handleAssignCosts = (ocGroup: GroupedByOC) => {
    console.log(
      "💰 [PendingFabricsCard] Abriendo modal para asignar costos a OC:",
      ocGroup.oc
    );
    setSelectedOCGroup(ocGroup);
    setFabricsWithCosts([...ocGroup.fabrics]);
    setShowCostsDialog(true);
  };

  const handleCostChange = (fabricId: string, cost: string) => {
    const costValue = cost.trim() === "" ? null : parseFloat(cost);

    setFabricsWithCosts((prevFabrics) =>
      prevFabrics.map((fabric) =>
        fabric.id === fabricId ? { ...fabric, costo: costValue } : fabric
      )
    );
  };

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

  const handleSaveCosts = async () => {
    if (!validateCosts() || !selectedOCGroup) return;

    console.log(
      "💾 [PendingFabricsCard] Guardando costos para OC:",
      selectedOCGroup.oc
    );
    setIsProcessing(true);

    try {
      const fabricsToSave = fabricsWithCosts.map((fabric) => ({
        ...fabric,
        sourceFileKey: fabric.fileName,
        sourceFile:
          fabric.fileName?.split("/").pop()?.replace(".json", "") || "",
      }));

      const uploadId = `${selectedOCGroup.oc}-${Date.now()}`;

      console.log("📤 [PendingFabricsCard] Enviando datos:", {
        fabricsCount: fabricsToSave.length,
        uploadId: uploadId,
        ocGroup: selectedOCGroup.oc,
        fileNames: selectedOCGroup.fileNames,
        firstFabric: fabricsToSave[0],
      });

      const response = await fetch("/api/packing-list/save-costs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fabrics: fabricsToSave,
          fileName: selectedOCGroup.fileNames[0],
          uploadId: uploadId,
          ocGroup: selectedOCGroup.oc,
          fileNames: selectedOCGroup.fileNames,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar los costos");
      }

      const result = await response.json();
      console.log(
        "✅ [PendingFabricsCard] Costos guardados exitosamente:",
        result
      );

      setInventory((prevInventory) => [
        ...prevInventory,
        ...result.inventoryItems,
      ]);

      setShowCostsDialog(false);
      setSelectedOCGroup(null);

      toast.success(
        `${result.inventoryItems.length} telas de OC ${selectedOCGroup.oc} agregadas al inventario`
      );

      console.log(
        "🔧 [PendingFabricsCard] TRIGGER 3: Verificación post-guardado de costos"
      );
      setTimeout(() => {
        checkPendingFiles();
      }, 1000);
    } catch (error) {
      console.error("❌ [PendingFabricsCard] Error al guardar costos:", error);
      toast.error("Error al guardar los costos y actualizar el inventario");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (groupedByOC.length === 0) {
    return null;
  }

  const totalFabrics = groupedByOC.reduce(
    (sum, group) => sum + group.totalFabrics,
    0
  );

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
                  {groupedByOC.length} OC
                  {groupedByOC.length !== 1 ? "s" : ""} con {totalFabrics} telas
                  que necesitan asignación de costos
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
                      onClick={handleManualRefresh}
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
                    <p>Verificar archivos pending manualmente</p>
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
            {groupedByOC.map((ocGroup) => (
              <div
                key={ocGroup.oc}
                className="flex items-center justify-between p-4 bg-white border border-orange-200 rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{ocGroup.oc}</h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{ocGroup.totalFabrics} telas</span>
                    <span>Procesado: {formatDate(ocGroup.processedAt)}</span>
                    <span className="text-xs">
                      {ocGroup.fileNames.length} archivo
                      {ocGroup.fileNames.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1">
                      {ocGroup.fabrics.slice(0, 3).map((fabric, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                        >
                          {fabric.tela} {fabric.color}
                        </span>
                      ))}
                      {ocGroup.fabrics.length > 3 && (
                        <span className="inline-block px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs">
                          +{ocGroup.fabrics.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignCosts(ocGroup)}
                          className="flex items-center gap-2"
                        >
                          <DollarSignIcon className="h-4 w-4" />
                          Asignar Costos
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Asignar costos a las {ocGroup.totalFabrics} telas de
                          esta OC
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCostsDialog} onOpenChange={setShowCostsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Asignar Costos - OC: {selectedOCGroup?.oc}
            </DialogTitle>
            <DialogDescription>
              {selectedOCGroup?.totalFabrics} telas detectadas en{" "}
              {selectedOCGroup?.fileNames.length} archivo
              {selectedOCGroup?.fileNames.length !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedOCGroup && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 text-left">Tela</th>
                      <th className="py-2 px-4 text-left">Color</th>
                      <th className="py-2 px-4 text-left">Cantidad</th>
                      <th className="py-2 px-4 text-left">Unidades</th>
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
