import React, { useEffect } from "react";
import { Search, Filter, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OrdersFilterSectionProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  ordenDeCompraFilter: string;
  setOrdenDeCompraFilter: React.Dispatch<React.SetStateAction<string>>;
  tipoTelaFilter: string;
  setTipoTelaFilter: React.Dispatch<React.SetStateAction<string>>;
  colorFilter: string;
  setColorFilter: React.Dispatch<React.SetStateAction<string>>;
  ubicacionFilter: string;
  setUbicacionFilter: React.Dispatch<React.SetStateAction<string>>;
  ordenDeCompraOptions: string[];
  tipoTelaOptions: string[];
  colorOptions: string[];
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileUploading: boolean;
  resetFilters: () => void;
}

export const OrdersFilterSection: React.FC<OrdersFilterSectionProps> = ({
  searchQuery,
  setSearchQuery,
  ordenDeCompraFilter,
  setOrdenDeCompraFilter,
  tipoTelaFilter,
  setTipoTelaFilter,
  colorFilter,
  setColorFilter,
  ubicacionFilter,
  setUbicacionFilter,
  ordenDeCompraOptions,
  tipoTelaOptions,
  colorOptions,
}) => {
  // Determinar si hay opciones disponibles para mostrar en los dropdowns
  const hasOrdenDeCompraOptions = ordenDeCompraOptions.length > 0;
  const hasTipoTelaOptions = tipoTelaOptions.length > 0;
  const hasColorOptions = colorOptions.length > 0;

  // Reset filters if selected value is no longer in available options
  useEffect(() => {
    if (
      ordenDeCompraFilter !== "all" &&
      !ordenDeCompraOptions.includes(ordenDeCompraFilter)
    ) {
      setOrdenDeCompraFilter("all");
    }
  }, [ordenDeCompraOptions, ordenDeCompraFilter, setOrdenDeCompraFilter]);

  useEffect(() => {
    if (tipoTelaFilter !== "all" && !tipoTelaOptions.includes(tipoTelaFilter)) {
      setTipoTelaFilter("all");
    }
  }, [tipoTelaOptions, tipoTelaFilter, setTipoTelaFilter]);

  useEffect(() => {
    if (colorFilter !== "all" && !colorOptions.includes(colorFilter)) {
      setColorFilter("all");
    }
  }, [colorOptions, colorFilter, setColorFilter]);

  return (
    <div className="mb-6 bg-white p-4 rounded shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        {/* Search bar */}
        <div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="search">Buscar</Label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <Input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por OC, Tela, o Color"
                className="pl-10 w-full h-9"
              />
            </div>
          </div>
        </div>

        {/* Orden de Compra filter */}
        <div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="orden-compra-filter">OC</Label>
              {!hasOrdenDeCompraOptions && ordenDeCompraFilter !== "all" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AlertCircle size={14} className="text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>No hay OCs disponibles con los filtros actuales</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select
              value={ordenDeCompraFilter}
              onValueChange={setOrdenDeCompraFilter}
            >
              <SelectTrigger id="orden-compra-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ordenDeCompraOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tipo de Tela filter */}
        <div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="tipo-tela-filter">Tela</Label>
              {!hasTipoTelaOptions && tipoTelaFilter !== "all" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AlertCircle size={14} className="text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        No hay tipos de tela disponibles con los filtros
                        actuales
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select value={tipoTelaFilter} onValueChange={setTipoTelaFilter}>
              <SelectTrigger id="tipo-tela-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {tipoTelaOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Color filter */}
        <div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="color-filter">Color</Label>
              {!hasColorOptions && colorFilter !== "all" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AlertCircle size={14} className="text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>No hay colores disponibles con los filtros actuales</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger id="color-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {colorOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ubicación filter */}
        <div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="ubicacion-filter">Ubicación</Label>
            </div>
            <Select value={ubicacionFilter} onValueChange={setUbicacionFilter}>
              <SelectTrigger id="ubicacion-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="almacen">Almacén</SelectItem>
                <SelectItem value="transito">En Tránsito</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Filter summary */}
      <div className="flex items-center gap-2 text-sm">
        <Filter size={16} className="text-gray-500" />
        <span className="text-gray-500">Filtros activos:</span>
        <div className="flex flex-wrap gap-2">
          {ordenDeCompraFilter && ordenDeCompraFilter !== "all" && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
              Orden: {ordenDeCompraFilter}
            </span>
          )}
          {tipoTelaFilter && tipoTelaFilter !== "all" && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
              Tela: {tipoTelaFilter}
            </span>
          )}
          {colorFilter && colorFilter !== "all" && (
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
              Color: {colorFilter}
            </span>
          )}
          {ubicacionFilter && ubicacionFilter !== "all" && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
              Ubicación: {ubicacionFilter}
            </span>
          )}
          {searchQuery && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
              Búsqueda: {searchQuery}
            </span>
          )}
          {(!ordenDeCompraFilter || ordenDeCompraFilter === "all") &&
            (!tipoTelaFilter || tipoTelaFilter === "all") &&
            (!colorFilter || colorFilter === "all") &&
            (!ubicacionFilter || ubicacionFilter === "all") &&
            !searchQuery && <span className="text-gray-500">Ninguno</span>}
        </div>
      </div>
    </div>
  );
};
