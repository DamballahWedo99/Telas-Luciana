"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Search, Filter } from "lucide-react";
import type { PriceHistoryFilters } from "@/types/price-history";

interface PriceHistoryFiltersProps {
  filters: PriceHistoryFilters;
  onFilterChange: (filters: PriceHistoryFilters) => void;
  availableFabrics: Array<{ id: string; name: string }>;
}

export const PriceHistoryFiltersComponent: React.FC<PriceHistoryFiltersProps> = ({
  filters,
  onFilterChange,
  availableFabrics,
}) => {
  const [localFilters, setLocalFilters] = useState<PriceHistoryFilters>(filters);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFabricSelect = (fabricId: string) => {
    if (fabricId === "all") {
      setLocalFilters({ ...localFilters, fabricIds: [] });
    } else {
      const newFabricIds = localFilters.fabricIds.includes(fabricId)
        ? localFilters.fabricIds.filter((id) => id !== fabricId)
        : [...localFilters.fabricIds, fabricId];
      
      setLocalFilters({ ...localFilters, fabricIds: newFabricIds });
    }
  };

  const handleDateChange = (field: "dateFrom" | "dateTo", value: string) => {
    setLocalFilters({ ...localFilters, [field]: value });
  };

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters: PriceHistoryFilters = {
      fabricIds: [],
      dateFrom: undefined,
      dateTo: undefined,
      providers: [],
      units: [],
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
    setSearchTerm("");
  };

  const filteredFabrics = availableFabrics.filter((fabric) =>
    fabric.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasActiveFilters =
    localFilters.fabricIds.length > 0 ||
    localFilters.dateFrom ||
    localFilters.dateTo ||
    (localFilters.providers && localFilters.providers.length > 0) ||
    (localFilters.units && localFilters.units.length > 0);

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="font-semibold">Filtros</h3>
          {hasActiveFilters && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {localFilters.fabricIds.length > 0 ? localFilters.fabricIds.length : 0} activos
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "Menos filtros" : "Más filtros"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fabric-search">Buscar Tela</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              id="fabric-search"
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-from">Fecha Desde</Label>
          <Input
            id="date-from"
            type="date"
            value={localFilters.dateFrom || ""}
            onChange={(e) => handleDateChange("dateFrom", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-to">Fecha Hasta</Label>
          <Input
            id="date-to"
            type="date"
            value={localFilters.dateTo || ""}
            onChange={(e) => handleDateChange("dateTo", e.target.value)}
          />
        </div>
      </div>

      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <Label>Telas Seleccionadas</Label>
            <div className="flex flex-wrap gap-2">
              {localFilters.fabricIds.length === 0 ? (
                <span className="text-sm text-gray-500">
                  Todas las telas seleccionadas
                </span>
              ) : (
                localFilters.fabricIds.map((fabricId) => (
                  <div
                    key={fabricId}
                    className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
                  >
                    <span>{fabricId}</span>
                    <button
                      onClick={() => handleFabricSelect(fabricId)}
                      className="hover:text-blue-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Seleccionar Telas</Label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2">
              <div className="space-y-1">
                <button
                  onClick={() => handleFabricSelect("all")}
                  className="w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                >
                  <span className="font-medium">Todas las telas</span>
                </button>
                {filteredFabrics.map((fabric) => (
                  <button
                    key={fabric.id}
                    onClick={() => handleFabricSelect(fabric.id)}
                    className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm ${
                      localFilters.fabricIds.includes(fabric.id)
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    {fabric.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearFilters}
          disabled={!hasActiveFilters}
        >
          Limpiar Filtros
        </Button>
        <Button size="sm" onClick={handleApplyFilters}>
          Aplicar Filtros
        </Button>
      </div>
    </div>
  );
};