"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  ChevronUpIcon, 
  ChevronDownIcon, 
  DownloadIcon,
  Loader2,
  FileText,
  Edit3
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { PriceHistoryTable } from "./PriceHistoryTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { PriceEditModal } from "./PriceEditModal";

interface PriceHistoryCardProps {
  initialFabricIds?: string[];
}

interface PriceHistoryTableRef {
  getActiveFilters: () => {
    searchTerm: string;
    filteredFabricIds: string[];
  };
}

export const PriceHistoryCard: React.FC<PriceHistoryCardProps> = ({
  initialFabricIds = [],
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'traditional' | 'provider-matrix'>('traditional');
  const [showEditModal, setShowEditModal] = useState(false);
  const tableRef = React.useRef<PriceHistoryTableRef>(null);
  
  const {
    data,
    multiProviderData,
    loading,
    error,
    fetchPriceHistory,
  } = usePriceHistory({
    initialFabricIds,
    autoFetch: true,
  });


  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      if (!data || !data.fabrics || data.fabrics.length === 0) {
        toast.error("No hay datos para exportar");
        return;
      }

      // Obtener filtros activos de la tabla si está disponible
      const activeFilters = tableRef.current?.getActiveFilters();
      
      // Determinar qué datos usar (filtrados o completos)
      let fabricsToExport = data.fabrics;
      if (activeFilters?.filteredFabricIds && activeFilters.filteredFabricIds.length > 0) {
        fabricsToExport = data.fabrics.filter(f => 
          activeFilters.filteredFabricIds.includes(f.fabricId)
        );
      }

      // Preparar datos para CSV combinando fabrics y summary
      const csvData = fabricsToExport.map(fabric => {
        const summary = data.summary.find(s => s.fabricId === fabric.fabricId);
        return {
          "Código Tela": fabric.fabricId,
          "Nombre Tela": fabric.fabricName,
          "Precio Mínimo": summary ? summary.minPrice.toFixed(2) : "N/A",
          "Precio Máximo": summary ? summary.maxPrice.toFixed(2) : "N/A",
          "Precio Promedio": summary ? summary.avgPrice.toFixed(2) : "N/A",
          "Unidad": summary ? summary.unit : "N/A",
          "Tendencia": summary ? (summary.trend === "up" ? "↑" : summary.trend === "down" ? "↓" : "=") : "N/A",
          "Última Actualización": fabric.lastUpdated || "N/A"
        };
      });

      // Convertir a CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(","),
        ...csvData.map(row => 
          headers.map(header => `"${row[header as keyof typeof row] || ""}"`).join(",")
        )
      ].join("\n");

      // Descargar archivo
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `historial-precios-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Mensaje de éxito personalizado según el filtro
      let successMessage = "CSV exportado exitosamente";
      if (activeFilters?.filteredFabricIds && activeFilters.filteredFabricIds.length > 0) {
        if (activeFilters.filteredFabricIds.length === 1) {
          const fabricName = fabricsToExport[0]?.fabricName || activeFilters.filteredFabricIds[0];
          successMessage += ` para la tela: ${fabricName}`;
        } else {
          successMessage += ` para ${fabricsToExport.length} telas filtradas`;
          if (activeFilters.searchTerm) {
            successMessage += ` que coinciden con "${activeFilters.searchTerm}"`;
          }
        }
      }
      toast.success(successMessage);
    } catch (error) {
      console.error("Error exportando CSV:", error);
      toast.error("Error al exportar el archivo CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Validar que hay datos para exportar según el modo de vista
      if (viewMode === 'traditional') {
        if (!data || !data.fabrics || data.fabrics.length === 0) {
          toast.error("No hay datos para exportar");
          return;
        }
      } else if (viewMode === 'provider-matrix') {
        if (!multiProviderData || !multiProviderData.fabrics || multiProviderData.fabrics.length === 0) {
          toast.error("No hay datos para exportar");
          return;
        }
      }

      // Importar el servicio de exportación PDF
      const { PDFExportService } = await import('@/lib/pdf-export-service');
      const pdfService = PDFExportService.getInstance();

      if (viewMode === 'traditional' && data) {
        // Obtener filtros activos de la tabla si está disponible
        const activeFilters = tableRef.current?.getActiveFilters();
        
        // Determinar qué datos usar (filtrados o completos)
        let dataToExport = data;
        if (activeFilters?.filteredFabricIds && activeFilters.filteredFabricIds.length > 0) {
          // Filtrar tanto fabrics como summary
          dataToExport = {
            ...data,
            fabrics: data.fabrics.filter(f => 
              activeFilters.filteredFabricIds.includes(f.fabricId)
            ),
            summary: data.summary.filter(s => 
              activeFilters.filteredFabricIds.includes(s.fabricId)
            )
          };
        }

        // Ejecutar exportación tradicional
        const result = await pdfService.exportTraditional(dataToExport);
        
        if (result.success) {
          let successMessage = "PDF exportado exitosamente";
          
          // Mostrar información específica sobre el filtro aplicado
          if (activeFilters?.filteredFabricIds && activeFilters.filteredFabricIds.length > 0) {
            if (activeFilters.filteredFabricIds.length === 1) {
              const fabricName = dataToExport.fabrics.find(f => f.fabricId === activeFilters.filteredFabricIds[0])?.fabricName || activeFilters.filteredFabricIds[0];
              successMessage += ` para la tela: ${fabricName}`;
            } else {
              successMessage += ` para ${dataToExport.fabrics.length} telas filtradas`;
              if (activeFilters.searchTerm) {
                successMessage += ` que coinciden con "${activeFilters.searchTerm}"`;
              }
            }
          }
          
          if (result.fileName) {
            successMessage += ` como "${result.fileName}"`;
          }
          if (result.pages && result.pages > 1) {
            successMessage += ` (${result.pages} páginas)`;
          }
          toast.success(successMessage);
        } else {
          toast.error(`Error al exportar PDF: ${result.error}`);
        }
      } else if (viewMode === 'provider-matrix' && multiProviderData) {
        // Validar datos antes de exportar
        const validation = pdfService.validateExportData(multiProviderData);
        
        if (!validation.isValid) {
          toast.error(`Error de validación: ${validation.errors.join(', ')}`);
          return;
        }

        // Mostrar advertencias si las hay
        if (validation.warnings.length > 0) {
          toast.warning(`Advertencias: ${validation.warnings.join(', ')}`);
        }

        // Obtener información de la estrategia que se usará
        const strategyInfo = pdfService.getStrategyInfo(multiProviderData);
        if (strategyInfo) {
          toast.info(`Usando estrategia: ${strategyInfo.reason}`);
        }

        // Detectar si hay filtro de tela específica activo
        let filterFabricId: string | undefined;
        let filteredData = multiProviderData;
        
        // Obtener filtros activos de la tabla si está disponible
        const activeFilters = tableRef.current?.getActiveFilters();
        
        if (activeFilters?.filteredFabricIds && activeFilters.filteredFabricIds.length > 0) {
          // Si hay filtros activos, aplicar el filtro a los datos
          filteredData = {
            ...multiProviderData,
            fabrics: multiProviderData.fabrics.filter(f => 
              activeFilters.filteredFabricIds.includes(f.fabricId)
            )
          };
          
          // Si solo queda una tela después del filtro, usar el filtro específico para nombre de archivo
          if (activeFilters.filteredFabricIds.length === 1) {
            filterFabricId = activeFilters.filteredFabricIds[0];
          }
        } else if (multiProviderData.fabrics.length === 1) {
          // Si ya hay solo una tela en los datos originales
          filterFabricId = multiProviderData.fabrics[0].fabricId;
        }

        // Ejecutar exportación
        const result = await pdfService.exportProviderMatrix(filteredData, undefined, undefined, filterFabricId);
        
        if (result.success) {
          let successMessage = "PDF exportado exitosamente";
          
          // Mostrar información específica sobre el filtro aplicado
          if (activeFilters?.filteredFabricIds && activeFilters.filteredFabricIds.length > 0) {
            if (activeFilters.filteredFabricIds.length === 1) {
              const fabricName = filteredData.fabrics.find(f => f.fabricId === filterFabricId)?.fabricName || filterFabricId;
              successMessage += ` para la tela: ${fabricName}`;
            } else {
              successMessage += ` para ${filteredData.fabrics.length} telas filtradas`;
              if (activeFilters.searchTerm) {
                successMessage += ` que coinciden con "${activeFilters.searchTerm}"`;
              }
            }
          } else if (multiProviderData.fabrics.length === 1) {
            const fabricName = multiProviderData.fabrics[0].fabricName || multiProviderData.fabrics[0].fabricId;
            successMessage += ` para la tela: ${fabricName}`;
          }
          
          if (result.fileName) {
            successMessage += ` como "${result.fileName}"`;
          }
          if (result.pages && result.pages > 1) {
            successMessage += ` (${result.pages} páginas)`;
          }
          if (result.segments && result.segments > 1) {
            successMessage += ` con ${result.segments} segmentos`;
          }
          toast.success(successMessage);
        } else {
          toast.error(`Error al exportar PDF: ${result.error}`);
        }
      } else {
        throw new Error('Modo de vista no válido o datos faltantes');
      }
      
    } catch (error) {
      console.error("Error exportando PDF:", error);
      toast.error(`Error al exportar el archivo PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsExporting(false);
    }
  };



  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex-1">
          <CardTitle className="flex items-center mb-1">
            <TrendingUp className="mr-2 h-5 w-5" />
            Historial de Precios
          </CardTitle>
          <CardDescription>
            Análisis y tendencias de precios de telas
          </CardDescription>
        </div>
        <div className="flex space-x-2">
          <TooltipProvider>
            {!collapsed && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setShowEditModal(true)}
                      disabled={!data || data.fabrics.length === 0}
                    >
                      <Edit3 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Editar precios</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isExporting}>
                          {isExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <DownloadIcon className="h-5 w-5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
                          <DownloadIcon className="h-4 w-4 mr-2" />
                          Exportar CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                          <FileText className="h-4 w-4 mr-2" />
                          Exportar PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Exportar datos</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed(!collapsed);
                  }}
                >
                  {collapsed ? (
                    <ChevronDownIcon className="h-5 w-5" />
                  ) : (
                    <ChevronUpIcon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{collapsed ? "Expandir" : "Colapsar"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-gray-500">
                Cargando datos...
              </div>
            </div>
          ) : data && data.fabrics.length > 0 ? (
            <PriceHistoryTable
              ref={tableRef}
              fabrics={data.fabrics}
              summary={data.summary}
              multiProviderData={multiProviderData}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No hay datos disponibles para mostrar
            </div>
          )}
        </CardContent>
      )}

      {showEditModal && data && (
        <PriceEditModal
          data={data}
          multiProviderData={multiProviderData}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onDataUpdated={() => {
            // Refresh data after successful update
            fetchPriceHistory(true);
          }}
        />
      )}
    </Card>
  );
};