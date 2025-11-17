"use client";

import React, { useState, useEffect } from "react";
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
  DownloadIcon,
  Loader2,
  Edit3,
  Plus,
  UserPlus,
  Filter,
  FileText
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
import { FabricCombobox } from "@/components/ui/fabric-combobox";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { PriceHistoryTable } from "./PriceHistoryTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { PriceEditModal } from "./PriceEditModal";
import { NewProductModal } from "./NewProductModal";
import { NewProviderModal } from "./NewProviderModal";
import { PDFExportService } from "@/lib/pdf-export-service";

interface PriceHistoryCardProps {
  initialFabricIds?: string[];
}

interface PriceHistoryTableRef {
  getActiveFilters: () => {
    searchTerm: string;
    filteredFabricIds: string[];
  };
}

// Mobile hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const mobileQuery = window.matchMedia("(max-width: 768px)");
      setIsMobile(mobileQuery.matches);
    };

    checkIsMobile();
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    mobileQuery.addEventListener("change", checkIsMobile);

    return () => {
      mobileQuery.removeEventListener("change", checkIsMobile);
    };
  }, []);

  return isMobile;
}

export const PriceHistoryCard: React.FC<PriceHistoryCardProps> = ({
  initialFabricIds = [],
}) => {
  const isMobile = useIsMobile();
  const [isExporting, setIsExporting] = useState(false);
  // Mobile-specific state
  const [mobileSelectedFabric, setMobileSelectedFabric] = useState<string>("");
  const [viewMode, setViewMode] = useState<'traditional' | 'provider-matrix'>('traditional');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showNewProviderModal, setShowNewProviderModal] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [isProviderFilterOpen, setIsProviderFilterOpen] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<string>("");
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

  // Initialize selected providers when multiProviderData changes
  React.useEffect(() => {
    if (multiProviderData?.providers) {
      setSelectedProviders(multiProviderData.providers.map(p => p.id));
    }
  }, [multiProviderData]);


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
    } catch {
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

      // Obtener instancia del servicio de exportación PDF
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

        // Determinar qué proveedores exportar
        // Si no hay proveedores seleccionados (array vacío), exportar todos
        const providersToExport = selectedProviders.length > 0 
          ? selectedProviders 
          : multiProviderData.providers.map(p => p.id);

        // Ejecutar exportación con proveedores seleccionados
        const result = await pdfService.exportProviderMatrix(filteredData, {
          filterFabricId,
          selectedProviders: providersToExport
        });
        
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
          
          // Añadir información sobre proveedores filtrados
          if (selectedProviders.length > 0 && selectedProviders.length < multiProviderData.providers.length) {
            successMessage += ` con ${providersToExport.length} proveedor${providersToExport.length === 1 ? '' : 'es'}`;
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
      toast.error(`Error al exportar el archivo PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleMobileProviderExport = async () => {
    if (!mobileSelectedFabric) {
      toast.error("Por favor selecciona una tela para exportar");
      return;
    }

    if (selectedProviders.length === 0) {
      toast.error("Por favor selecciona al menos un proveedor para exportar");
      return;
    }

    setIsExporting(true);
    try {
      // Ensure we have multi-provider data
      if (!multiProviderData || !multiProviderData.fabrics || multiProviderData.fabrics.length === 0) {
        toast.error("No hay datos de proveedores disponibles");
        return;
      }

      // Find the selected fabric
      const selectedFabricData = multiProviderData.fabrics.find(f => f.fabricId === mobileSelectedFabric);
      if (!selectedFabricData) {
        toast.error("La tela seleccionada no tiene datos disponibles");
        return;
      }

      // Create filtered data with only the selected fabric
      const filteredData = {
        ...multiProviderData,
        fabrics: [selectedFabricData]
      };

      // Get PDF service instance
      const pdfService = PDFExportService.getInstance();

      // Export provider matrix for the selected fabric with selected providers
      const result = await pdfService.exportProviderMatrix(filteredData, {
        filterFabricId: mobileSelectedFabric,
        selectedProviders: selectedProviders
      });
      
      if (result.success) {
        const fabricName = selectedFabricData.fabricName || mobileSelectedFabric;
        let successMessage = `PDF exportado exitosamente para la tela: ${fabricName}`;
        
        // Add provider count information
        if (selectedProviders.length < multiProviderData.providers.length) {
          successMessage += ` con ${selectedProviders.length} proveedor${selectedProviders.length === 1 ? '' : 'es'} seleccionado${selectedProviders.length === 1 ? '' : 's'}`;
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
    } catch (error) {
      toast.error(`Error al exportar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isMobile) {
    return (
      <div className="px-4">
        <div className="max-w-lg w-full mx-auto space-y-4">
          {/* Simplified Mobile Header */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-3">
              <Filter className="mr-2 h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">
                Exportar por Proveedor
              </h1>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Selecciona una tela y los proveedores para descargar la comparación
            </p>
          </div>

          {/* Mobile Filter & Export */}
          <div className="bg-white rounded-lg shadow p-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-pulse text-gray-500">
                  Cargando datos...
                </div>
              </div>
            ) : data && data.fabrics.length > 0 ? (
              <div className="space-y-4">
                {/* Fabric Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Tela
                  </label>
                  <FabricCombobox
                    fabrics={data.fabrics.map(f => ({ fabricId: f.fabricId, fabricName: f.fabricName }))}
                    value={mobileSelectedFabric}
                    onValueChange={setMobileSelectedFabric}
                    placeholder="Elige una tela para comparar proveedores"
                    className="w-full"
                  />
                </div>

                {/* Provider Selection */}
                {mobileSelectedFabric && multiProviderData && multiProviderData.providers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Seleccionar Proveedores ({selectedProviders.length} de {multiProviderData.providers.length})
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                      {multiProviderData.providers.map((provider) => (
                        <div key={provider.id} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`mobile-provider-${provider.id}`}
                            checked={selectedProviders.includes(provider.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProviders(prev => [...prev, provider.id]);
                              } else {
                                setSelectedProviders(prev => prev.filter(id => id !== provider.id));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor={`mobile-provider-${provider.id}`}
                            className="text-sm text-gray-700 cursor-pointer flex-1"
                          >
                            {provider.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProviders(multiProviderData.providers.map(p => p.id))}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedProviders([])}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Deseleccionar todos
                      </button>
                    </div>
                  </div>
                )}

                {/* Export Button */}
                <Button 
                  onClick={handleMobileProviderExport}
                  disabled={!mobileSelectedFabric || selectedProviders.length === 0 || isExporting}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Descargar PDF ({selectedProviders.length} proveedor{selectedProviders.length !== 1 ? 'es' : ''})
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No hay datos disponibles</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full shadow h-[85vh] flex flex-col">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setShowNewProductModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Producto
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowNewProviderModal(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Nuevo Proveedor
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent>
                <p>Agregar</p>
              </TooltipContent>
            </Tooltip>

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
                  <DropdownMenuContent className="w-auto min-w-0">
                    <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                      Exportar PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent>
                <p>Exportar datos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 flex-1 overflow-auto">
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
              selectedProviders={selectedProviders}
              onSelectedProvidersChange={setSelectedProviders}
              isProviderFilterOpen={isProviderFilterOpen}
              onProviderFilterOpenChange={setIsProviderFilterOpen}
              selectedFabric={selectedFabric}
              onSelectedFabricChange={setSelectedFabric}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No hay datos disponibles para mostrar
            </div>
          )}
        </CardContent>

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

      <NewProductModal
        open={showNewProductModal}
        onClose={() => setShowNewProductModal(false)}
        onProductCreated={() => {
          // Refresh data after successful product creation
          toast.success("Producto creado exitosamente");
          fetchPriceHistory(true);
        }}
        existingFabricIds={data?.fabrics?.map(f => f.fabricId) || []}
      />

      <NewProviderModal
        open={showNewProviderModal}
        onClose={() => setShowNewProviderModal(false)}
        onProviderAdded={() => {
          
          // Force cleanup of any lingering dialog overlays
          setTimeout(() => {
            const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
            overlays.forEach((overlay) => {
              overlay.remove();
            });
          }, 50);
          
          // Refresh data after successful provider addition
          toast.success("Proveedor agregado exitosamente");
          fetchPriceHistory(true);
        }}
        availableFabrics={data?.fabrics || []}
      />
    </Card>
  );
};