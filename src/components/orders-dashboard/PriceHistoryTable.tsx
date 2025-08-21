"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  Grid,
  List,
  Expand,
  Minimize,
} from "lucide-react";
import type {
  FabricPriceHistory,
  PriceHistorySummary,
  MultiProviderTableData,
  FabricProviderMatrix,
} from "@/types/price-history";
import { ProviderCell, ProviderHeader } from "./ProviderComponents";
import {
  getTrendColor,
  formatCurrency,
  formatMinMaxDate,
} from "@/hooks/usePriceHistory";

interface PriceHistoryTableProps {
  fabrics: FabricPriceHistory[];
  summary: PriceHistorySummary[];
  multiProviderData?: MultiProviderTableData | null;
  viewMode?: "traditional" | "provider-matrix";
  onViewModeChange?: (mode: "traditional" | "provider-matrix") => void;
}

interface PriceHistoryTableRef {
  getActiveFilters: () => {
    searchTerm: string;
    filteredFabricIds: string[];
  };
}

type SortField = "fabric" | "minPrice" | "maxPrice" | "lastUpdated";
type SortOrder = "asc" | "desc";
type ProviderSortField = "fabric" | string; // string for provider IDs

export const PriceHistoryTable = React.forwardRef<PriceHistoryTableRef, PriceHistoryTableProps>(({
  fabrics,
  summary,
  multiProviderData,
  viewMode = "traditional",
  onViewModeChange,
}, ref) => {
  const [sortField, setSortField] = useState<SortField>("fabric");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 50;

  // Provider matrix state
  const [providerSortField, setProviderSortField] =
    useState<ProviderSortField>("fabric");
  const [providerSortOrder, setProviderSortOrder] = useState<SortOrder>("asc");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showOnlyWithData, setShowOnlyWithData] = useState(false);
  const [expandAll, setExpandAll] = useState(false);

  // Traditional table data
  const tableData = useMemo(() => {
    const summaryMap = new Map(summary.map((s) => [s.fabricId, s]));
    const allFabricData: Array<{
      id: string;
      fabric: string;
      currentPrice: number;
      minPrice: number;
      maxPrice: number;
      avgPrice: number;
      totalEntries: number;
      unit: string;
      trend: "up" | "down" | "stable";
      changePercent: number;
      lastUpdated: string;
      hasData: boolean;
      minPriceProvider: string;
      minPriceDate: string;
      maxPriceProvider: string;
      maxPriceDate: string;
    }> = [];

    fabrics.forEach((fabric) => {
      const fabricSummary = summaryMap.get(fabric.fabricId);

      if (fabricSummary) {
        allFabricData.push({
          id: fabric.fabricId,
          fabric: fabric.fabricName,
          currentPrice: fabricSummary.currentPrice,
          minPrice: fabricSummary.minPrice,
          maxPrice: fabricSummary.maxPrice,
          avgPrice: fabricSummary.avgPrice,
          totalEntries: fabricSummary.totalEntries,
          unit: fabricSummary.unit,
          trend: fabricSummary.trend,
          changePercent: fabricSummary.priceChangePercent,
          lastUpdated: fabricSummary.lastUpdated,
          hasData: true,
          minPriceProvider: fabricSummary.minPriceProvider,
          minPriceDate: fabricSummary.minPriceDate,
          maxPriceProvider: fabricSummary.maxPriceProvider,
          maxPriceDate: fabricSummary.maxPriceDate,
        });
      } else {
        allFabricData.push({
          id: fabric.fabricId,
          fabric: fabric.fabricName,
          currentPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0,
          totalEntries: 0,
          unit: "N/A",
          trend: "stable" as const,
          changePercent: 0,
          lastUpdated: fabric.lastUpdated || "",
          hasData: false,
          minPriceProvider: "N/A",
          minPriceDate: "",
          maxPriceProvider: "N/A",
          maxPriceDate: "",
        });
      }
    });

    return allFabricData;
  }, [fabrics, summary]);

  // Provider matrix data processing
  const filteredProviderData = useMemo(() => {
    if (!multiProviderData) return { fabrics: [], providers: [] };

    let filteredFabrics = multiProviderData.fabrics;
    let availableProviders = multiProviderData.providers;

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredFabrics = filteredFabrics.filter(
        (fabric) =>
          fabric.fabricName.toLowerCase().includes(searchLower) ||
          fabric.fabricId.toLowerCase().includes(searchLower)
      );
    }

    // Filter by selected providers
    if (selectedProviders.length > 0) {
      availableProviders = availableProviders.filter((p) =>
        selectedProviders.includes(p.id)
      );
    }

    // Filter to show only fabrics with data
    if (showOnlyWithData) {
      filteredFabrics = filteredFabrics.filter((fabric) => fabric.hasAnyData);
    }

    // Sort fabrics
    const sortedFabrics = [...filteredFabrics].sort((a, b) => {
      if (providerSortField === "fabric") {
        const aValue = a.fabricName;
        const bValue = b.fabricName;
        if (aValue < bValue) return providerSortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return providerSortOrder === "asc" ? 1 : -1;
        return 0;
      } else {
        // Sort by provider price
        const aProvider = a.providers[providerSortField];
        const bProvider = b.providers[providerSortField];

        // Fabrics without data for this provider go to the end
        if (!aProvider && !bProvider) return 0;
        if (!aProvider) return 1;
        if (!bProvider) return -1;

        const aValue = aProvider.price;
        const bValue = bProvider.price;
        if (aValue < bValue) return providerSortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return providerSortOrder === "asc" ? 1 : -1;
        return 0;
      }
    });

    return { fabrics: sortedFabrics, providers: availableProviders };
  }, [
    multiProviderData,
    searchTerm,
    selectedProviders,
    showOnlyWithData,
    providerSortField,
    providerSortOrder,
  ]);

  // Use appropriate data based on view mode
  const currentData =
    viewMode === "provider-matrix" ? filteredProviderData.fabrics : tableData;

  const filteredData = useMemo(() => {
    if (viewMode === "provider-matrix") {
      return currentData as FabricProviderMatrix[];
    }

    if (!searchTerm.trim()) {
      return tableData;
    }

    const searchLower = searchTerm.toLowerCase();
    return tableData.filter(
      (item) =>
        item.fabric.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower)
    );
  }, [viewMode, currentData, tableData, searchTerm]);

  // Reset pagination when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode, selectedProviders, showOnlyWithData]);

  const sortedData = useMemo(() => {
    if (viewMode === "provider-matrix") {
      return filteredData; // Already sorted in filteredProviderData
    }

    return [...(filteredData as typeof tableData)].sort((a, b) => {
      let aValue: string | number | Date = a[sortField];
      let bValue: string | number | Date = b[sortField];

      if (sortField === "lastUpdated") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortOrder, viewMode]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Exponer métodos a través del ref
  React.useImperativeHandle(ref, () => ({
    getActiveFilters: () => {
      if (viewMode === "provider-matrix") {
        return {
          searchTerm,
          filteredFabricIds: filteredProviderData.fabrics.map(f => f.fabricId)
        };
      }
      return {
        searchTerm,
        filteredFabricIds: filteredData.map((item: any) => item.id)
      };
    }
  }), [searchTerm, filteredProviderData, filteredData, viewMode]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleProviderSort = (field: ProviderSortField) => {
    if (providerSortField === field) {
      setProviderSortOrder(providerSortOrder === "asc" ? "desc" : "asc");
    } else {
      setProviderSortField(field);
      setProviderSortOrder("asc");
    }
  };

  const getTrendDisplay = (
    trend?: "up" | "down" | "stable",
    changePercent?: number
  ) => {
    if (!trend) return null;

    const Icon =
      trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
    const color = getTrendColor(trend);

    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        {changePercent !== undefined && (
          <span className="text-xs font-medium">
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </span>
        )}
      </div>
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedProviders([]);
    setShowOnlyWithData(false);
    setExpandAll(false);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4">
        {/* Top row: Search and View Mode Toggle */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Buscar por nombre o código de tela..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* View Mode Toggle */}
          {multiProviderData && onViewModeChange && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Button
                variant={viewMode === "traditional" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("traditional")}
                className="h-8"
              >
                <List className="h-4 w-4 mr-2" />
                Tradicional
              </Button>
              <Button
                variant={viewMode === "provider-matrix" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("provider-matrix")}
                className="h-8"
              >
                <Grid className="h-4 w-4 mr-2" />
                Por Proveedor
              </Button>
            </div>
          )}
        </div>

        {/* Provider matrix filters */}
        {viewMode === "provider-matrix" && multiProviderData && (
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="showOnlyWithData"
                type="checkbox"
                checked={showOnlyWithData}
                onChange={(e) => setShowOnlyWithData(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="showOnlyWithData" className="text-sm">
                Solo con datos
              </label>
            </div>

            {/* Expand/Collapse All Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandAll(!expandAll)}
              className="flex items-center gap-2"
            >
              {expandAll ? (
                <>
                  <Minimize className="h-4 w-4" />
                  Contraer Todo
                </>
              ) : (
                <>
                  <Expand className="h-4 w-4" />
                  Expandir Todo
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="ml-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        )}

        {/* Results info */}
        {searchTerm && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {filteredData.length} de{" "}
            {viewMode === "provider-matrix"
              ? multiProviderData?.totalFabrics
              : tableData.length}{" "}
            telas
          </span>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              {viewMode === "provider-matrix" && multiProviderData ? (
                <TableRow className="bg-gray-50 dark:bg-gray-800 border-b">
                  <TableHead className="min-w-[200px] border-r border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleProviderSort("fabric")}
                      className="flex items-center gap-1 font-semibold hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      Tela
                      {providerSortField === "fabric" &&
                        (providerSortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </TableHead>
                  {filteredProviderData.providers.map((provider) => (
                    <ProviderHeader
                      key={provider.id}
                      provider={provider}
                      onSort={handleProviderSort}
                      sortedBy={providerSortField}
                      sortOrder={providerSortOrder}
                    />
                  ))}
                </TableRow>
              ) : (
                <TableRow className="bg-gray-50 dark:bg-gray-800 border-b">
                  <TableHead className="font-semibold">
                    <button
                      onClick={() => handleSort("fabric")}
                      className="flex items-center gap-1 font-semibold hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      Tela
                      {sortField === "fabric" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    <button
                      onClick={() => handleSort("minPrice")}
                      className="flex items-center gap-1 font-semibold hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      Precio Mínimo
                      {sortField === "minPrice" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Proveedor
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Fecha
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    <button
                      onClick={() => handleSort("maxPrice")}
                      className="flex items-center gap-1 font-semibold hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      Precio Máximo
                      {sortField === "maxPrice" &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Proveedor
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Fecha
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Tendencia
                  </TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                viewMode === "provider-matrix" && multiProviderData ? (
                  (paginatedData as FabricProviderMatrix[]).map(
                    (fabric, index) => (
                      <TableRow
                        key={fabric.fabricId}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          index % 2 === 0
                            ? "bg-white dark:bg-gray-900"
                            : "bg-gray-25 dark:bg-gray-900/50"
                        } ${!fabric.hasAnyData ? "opacity-60" : ""}`}
                      >
                        <TableCell className="font-medium py-4 border-r border-gray-200 dark:border-gray-700">
                          {fabric.fabricName}
                          {!fabric.hasAnyData && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              (Sin datos)
                            </span>
                          )}
                        </TableCell>
                        {filteredProviderData.providers.map((provider) => (
                          <TableCell
                            key={provider.id}
                            className="py-0 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                          >
                            <ProviderCell
                              data={fabric.providers[provider.id]}
                              fabricId={fabric.fabricId}
                              forceExpanded={expandAll}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  )
                ) : (
                  (paginatedData as typeof tableData).map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                        index % 2 === 0
                          ? "bg-white dark:bg-gray-900"
                          : "bg-gray-25 dark:bg-gray-900/50"
                      } ${!row.hasData ? "opacity-60" : ""}`}
                    >
                      <TableCell className="font-medium py-4">
                        {row.fabric}
                        {!row.hasData && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            (Sin datos)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4 text-green-600 dark:text-green-400">
                        {row.hasData ? (
                          <span className="font-semibold">
                            {formatCurrency(row.minPrice)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {row.hasData ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {row.minPriceProvider}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {row.hasData ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatMinMaxDate(row.minPriceDate)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4 text-red-600 dark:text-red-400">
                        {row.hasData ? (
                          <span className="font-semibold">
                            {formatCurrency(row.maxPrice)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {row.hasData ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {row.maxPriceProvider}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {row.hasData ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatMinMaxDate(row.maxPriceDate)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {row.hasData
                          ? getTrendDisplay(row.trend, row.changePercent)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={
                      viewMode === "provider-matrix"
                        ? filteredProviderData.providers.length + 1
                        : 8
                    }
                    className="text-center py-12 text-gray-500"
                  >
                    No se encontraron registros de telas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Mostrando{" "}
            <span className="font-medium">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            a{" "}
            <span className="font-medium">
              {Math.min(currentPage * itemsPerPage, sortedData.length)}
            </span>{" "}
            de <span className="font-medium">{sortedData.length}</span> telas
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="text-sm px-3 py-1 bg-white dark:bg-gray-700 rounded border">
              Página <span className="font-medium">{currentPage}</span> de{" "}
              <span className="font-medium">{totalPages}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

PriceHistoryTable.displayName = 'PriceHistoryTable';
