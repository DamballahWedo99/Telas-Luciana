"use client";

import React, { useState, useMemo, useCallback, lazy, Suspense } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  TrendingUp,
  BarChart3,
  Calendar,
  Info,
  DownloadIcon,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FabricCombobox } from "@/components/ui/fabric-combobox";
import { PriceFluctuationPDFExporter } from "@/lib/pdf-exporters/price-fluctuation-pdf-exporter";
// Lazy load the chart component for better performance
const PriceFluctuationChart = lazy(() => 
  import("./PriceFluctuationChart").then(module => ({ 
    default: module.PriceFluctuationChart 
  }))
);
import type { 
  PriceHistoryResponse, 
  PriceHistoryEntry
} from "@/types/price-history";

interface PriceAnalysisCardProps {
  data: PriceHistoryResponse | null;
  loading?: boolean;
  className?: string;
}

interface PriceFluctuationData {
  date: string;
  [providerKey: string]: number | string | null;
}

interface ProviderStats {
  provider: string;
  totalEntries: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  color: string;
}

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

export const PriceAnalysisCard = React.memo<PriceAnalysisCardProps>(({
  data,
  loading = false,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Get available fabrics for selection
  const availableFabrics = useMemo(() => {
    if (!data?.fabrics) return [];
    
    return data.fabrics
      .filter(fabric => fabric.history && fabric.history.length > 0)
      .map(fabric => ({
        fabricId: fabric.fabricId,
        fabricName: fabric.fabricName
      }));
  }, [data?.fabrics]);

  // Get selected fabric data
  const selectedFabricData = useMemo(() => {
    if (!selectedFabric || !data?.fabrics) return null;
    return data.fabrics.find(fabric => fabric.fabricId === selectedFabric) || null;
  }, [selectedFabric, data?.fabrics]);

  // Transform price history data for chart visualization
  const chartData = useMemo(() => {
    if (!selectedFabricData?.history) return [];

    // Group entries by provider
    const providerEntries: Record<string, PriceHistoryEntry[]> = {};
    selectedFabricData.history.forEach(entry => {
      if (!providerEntries[entry.provider]) {
        providerEntries[entry.provider] = [];
      }
      providerEntries[entry.provider].push(entry);
    });

    // Sort entries by date for each provider
    Object.keys(providerEntries).forEach(provider => {
      providerEntries[provider].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });

    // Get all unique dates and sort them
    const allDates = Array.from(
      new Set(selectedFabricData.history.map(entry => entry.date))
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Create chart data points
    const chartPoints: PriceFluctuationData[] = allDates.map(date => {
      const point: PriceFluctuationData = { date };
      
      // Add price data for each provider if they have data for this date
      Object.keys(providerEntries).forEach(provider => {
        const entryForDate = providerEntries[provider].find(
          entry => entry.date === date
        );
        // Explicitly set null for missing data to ensure proper line connection
        point[provider] = entryForDate ? entryForDate.quantity : null;
      });

      return point;
    });

    return chartPoints;
  }, [selectedFabricData]);

  // Calculate provider statistics
  const providerStats = useMemo(() => {
    if (!selectedFabricData?.history) return [];

    const providerEntries: Record<string, PriceHistoryEntry[]> = {};
    selectedFabricData.history.forEach(entry => {
      if (!providerEntries[entry.provider]) {
        providerEntries[entry.provider] = [];
      }
      providerEntries[entry.provider].push(entry);
    });

    const stats: ProviderStats[] = Object.keys(providerEntries).map((provider, index) => {
      const entries = providerEntries[provider];
      const prices = entries.map(entry => entry.quantity);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      return {
        provider,
        totalEntries: entries.length,
        avgPrice,
        minPrice,
        maxPrice,
        priceRange: maxPrice - minPrice,
        color: COLORS[index % COLORS.length]
      };
    });

    return stats.sort((a, b) => b.totalEntries - a.totalEntries);
  }, [selectedFabricData]);

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);


  const handleExportPDF = useCallback(async () => {
    if (!selectedFabricData || !providerStats.length) {
      toast.error("Por favor, selecciona una tela para exportar el análisis");
      return;
    }

    setIsExporting(true);
    try {
      const exporter = new PriceFluctuationPDFExporter();
      
      // Prepare export data
      const exportData = {
        fabricId: selectedFabricData.fabricId,
        fabricName: selectedFabricData.fabricName,
        history: selectedFabricData.history,
        providers: providerStats
      };
      
      await exporter.export(exportData);
      toast.success(`PDF exportado exitosamente para ${selectedFabricData.fabricName}`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar el PDF");
    } finally {
      setIsExporting(false);
    }
  }, [selectedFabricData, providerStats]);


  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span>Análisis de Fluctuación de Precios</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Cargando análisis...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !availableFabrics.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-gray-400" />
              <span>Análisis de Fluctuación de Precios</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No hay datos de historial de precios disponibles</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>Análisis de Fluctuación de Precios</span>
            {availableFabrics.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {availableFabrics.length} tela{availableFabrics.length !== 1 ? 's' : ''} con historial
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              {isExpanded && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleExportPDF}
                      disabled={isExporting || !selectedFabric}
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <DownloadIcon className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Exportar PDF</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleExpanded}
                    className="h-8 w-8 p-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isExpanded ? 'Colapsar' : 'Expandir'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        {isExpanded && (
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Tela:</span>
              <FabricCombobox
                fabrics={[
                  { fabricId: "", fabricName: "Seleccionar tela..." },
                  ...availableFabrics
                ]}
                value={selectedFabric}
                onValueChange={setSelectedFabric}
                placeholder="Seleccionar tela para análisis"
                className="w-64 h-8"
              />
            </div>
            
            {selectedFabricData && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{selectedFabricData.history.length} registros</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>{providerStats.length} proveedor{providerStats.length !== 1 ? 'es' : ''}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {selectedFabric && selectedFabricData ? (
            <div className="space-y-6">
              {/* Price Fluctuation Chart */}
              {chartData.length > 0 ? (
                <Suspense fallback={
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Cargando gráfico...</p>
                    </div>
                  </div>
                }>
                  <PriceFluctuationChart
                    data={chartData}
                    providers={providerStats}
                    fabricName={selectedFabricData.fabricName}
                  />
                </Suspense>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Info className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No hay suficientes datos para generar el gráfico</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Selecciona una tela para ver su análisis de fluctuación de precios</p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
});

PriceAnalysisCard.displayName = 'PriceAnalysisCard';