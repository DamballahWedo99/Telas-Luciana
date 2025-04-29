import React, { useEffect, useRef, useMemo } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  Upload,
  Loader2,
  ShoppingCartIcon,
  XCircleIcon,
  Search,
  Filter,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { OrdersTable } from "./OrdersTable";
import { EmptyState } from "./EmptyState";

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
  handleFileUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileUploading?: boolean;
  resetFilters: () => void;
}

const OrdersFilterSection: React.FC<OrdersFilterSectionProps> = ({
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
  resetFilters,
}) => {
  // Determinar si hay opciones disponibles para mostrar en los dropdowns
  const hasOrdenDeCompraOptions = ordenDeCompraOptions.length > 0;
  const hasTipoTelaOptions = tipoTelaOptions.length > 0;
  const hasColorOptions = colorOptions.length > 0;

  // Verificar si algún filtro está activo
  const isFilterActive =
    searchQuery !== "" ||
    ordenDeCompraFilter !== "all" ||
    tipoTelaFilter !== "all" ||
    colorFilter !== "all" ||
    ubicacionFilter !== "all";

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
    <div className="pt-0 pb-4">
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Search bar - más grande */}
        <div className="flex-1 min-w-[200px]">
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

        {/* Orden de Compra filter - más pequeño */}
        <div className="min-w-[150px] max-w-[150px]">
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
              <SelectTrigger
                id="orden-compra-filter"
                className="w-full truncate"
              >
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ordenDeCompraOptions
                  .slice()
                  .reverse()
                  .map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tipo de Tela filter - más pequeño */}
        <div className="min-w-[150px] max-w-[150px]">
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
              <SelectTrigger id="tipo-tela-filter" className="w-full truncate">
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

        {/* Color filter - más pequeño */}
        <div className="min-w-[150px] max-w-[150px]">
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
              <SelectTrigger id="color-filter" className="w-full truncate">
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

        {/* Ubicación filter - más pequeño */}
        <div className="min-w-[150px] max-w-[150px]">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="ubicacion-filter">Ubicación</Label>
            </div>
            <Select value={ubicacionFilter} onValueChange={setUbicacionFilter}>
              <SelectTrigger id="ubicacion-filter" className="w-full truncate">
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
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
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

interface PedidoData {
  [key: string]: any;
}

interface OrdersCardProps {
  data: PedidoData[];
  filteredData: PedidoData[];
  paginatedData: PedidoData[];
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
  formatDate: (dateString?: string) => string;
  formatCurrency: (value: number, decimals?: number) => string;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  ordersCollapsed: boolean;
  setOrdersCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export const OrdersCard: React.FC<OrdersCardProps> = ({
  data,
  filteredData,
  paginatedData,
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
  ordenDeCompraOptions: allOrdenDeCompraOptions,
  tipoTelaOptions: allTipoTelaOptions,
  colorOptions: allColorOptions,
  handleFileUpload,
  fileUploading,
  resetFilters,
  formatDate,
  formatCurrency,
  currentPage,
  totalPages,
  goToPage,
  ordersCollapsed,
  setOrdersCollapsed,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Verificar si algún filtro está activo
  const isFilterActive =
    searchQuery !== "" ||
    ordenDeCompraFilter !== "all" ||
    tipoTelaFilter !== "all" ||
    colorFilter !== "all" ||
    ubicacionFilter !== "all";

  // Calcular opciones filtradas para cada selector basado en las selecciones actuales
  const filteredOptions = useMemo(() => {
    // Filtros para cada selector dependiendo de otras selecciones
    const getFilteredOrdenDeCompraOptions = () => {
      let filtered = [...data];

      if (tipoTelaFilter && tipoTelaFilter !== "all") {
        filtered = filtered.filter(
          (item) => item["pedido_cliente.tipo_tela"] === tipoTelaFilter
        );
      }

      if (colorFilter && colorFilter !== "all") {
        filtered = filtered.filter(
          (item) => item["pedido_cliente.color"] === colorFilter
        );
      }

      if (ubicacionFilter && ubicacionFilter !== "all") {
        // Asumiendo que ubicación se determina en base a dónde está el item
        const ubicacionField =
          ubicacionFilter === "almacen"
            ? "llega_almacen_proveedor"
            : ubicacionFilter === "transito"
            ? "llega_a_Lazaro"
            : "fecha_pedido"; // proveedor

        filtered = filtered.filter((item) => item[ubicacionField]);
      }

      return [...new Set(filtered.map((item) => item.orden_de_compra))].filter(
        Boolean
      );
    };

    const getFilteredTipoTelaOptions = () => {
      let filtered = [...data];

      if (ordenDeCompraFilter && ordenDeCompraFilter !== "all") {
        filtered = filtered.filter(
          (item) => item.orden_de_compra === ordenDeCompraFilter
        );
      }

      if (colorFilter && colorFilter !== "all") {
        filtered = filtered.filter(
          (item) => item["pedido_cliente.color"] === colorFilter
        );
      }

      if (ubicacionFilter && ubicacionFilter !== "all") {
        const ubicacionField =
          ubicacionFilter === "almacen"
            ? "llega_almacen_proveedor"
            : ubicacionFilter === "transito"
            ? "llega_a_Lazaro"
            : "fecha_pedido"; // proveedor

        filtered = filtered.filter((item) => item[ubicacionField]);
      }

      return [
        ...new Set(filtered.map((item) => item["pedido_cliente.tipo_tela"])),
      ].filter(Boolean);
    };

    const getFilteredColorOptions = () => {
      let filtered = [...data];

      if (ordenDeCompraFilter && ordenDeCompraFilter !== "all") {
        filtered = filtered.filter(
          (item) => item.orden_de_compra === ordenDeCompraFilter
        );
      }

      if (tipoTelaFilter && tipoTelaFilter !== "all") {
        filtered = filtered.filter(
          (item) => item["pedido_cliente.tipo_tela"] === tipoTelaFilter
        );
      }

      if (ubicacionFilter && ubicacionFilter !== "all") {
        const ubicacionField =
          ubicacionFilter === "almacen"
            ? "llega_almacen_proveedor"
            : ubicacionFilter === "transito"
            ? "llega_a_Lazaro"
            : "fecha_pedido"; // proveedor

        filtered = filtered.filter((item) => item[ubicacionField]);
      }

      return [
        ...new Set(filtered.map((item) => item["pedido_cliente.color"])),
      ].filter(Boolean);
    };

    return {
      ordenDeCompraOptions: getFilteredOrdenDeCompraOptions(),
      tipoTelaOptions: getFilteredTipoTelaOptions(),
      colorOptions: getFilteredColorOptions(),
    };
  }, [data, ordenDeCompraFilter, tipoTelaFilter, colorFilter, ubicacionFilter]);

  return (
    <Card className="mb-6 shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center mb-1">
            <ShoppingCartIcon className="mr-2 h-5 w-5" />
            Órdenes de Compra
          </CardTitle>
          <CardDescription>
            {filteredData.length} pedidos encontrados
          </CardDescription>
        </div>
        <div className="flex space-x-2">
          <input
            type="file"
            id="file-upload"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <TooltipProvider>
            {isFilterActive && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={resetFilters}>
                      <XCircleIcon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Limpiar filtros</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerFileUpload}
                  disabled={fileUploading}
                >
                  {fileUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
                      Cargando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" /> Cargar CSV
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cargar archivo CSV de pedidos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOrdersCollapsed(!ordersCollapsed)}
                >
                  {ordersCollapsed ? (
                    <ChevronDownIcon className="h-5 w-5" />
                  ) : (
                    <ChevronUpIcon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{ordersCollapsed ? "Expandir" : "Colapsar"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!ordersCollapsed && (
        <>
          <CardContent className="pt-0 pb-4">
            {data.length > 0 ? (
              <OrdersFilterSection
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                ordenDeCompraFilter={ordenDeCompraFilter}
                setOrdenDeCompraFilter={setOrdenDeCompraFilter}
                tipoTelaFilter={tipoTelaFilter}
                setTipoTelaFilter={setTipoTelaFilter}
                colorFilter={colorFilter}
                setColorFilter={setColorFilter}
                ubicacionFilter={ubicacionFilter}
                setUbicacionFilter={setUbicacionFilter}
                ordenDeCompraOptions={filteredOptions.ordenDeCompraOptions}
                tipoTelaOptions={filteredOptions.tipoTelaOptions}
                colorOptions={filteredOptions.colorOptions}
                handleFileUpload={handleFileUpload}
                fileUploading={fileUploading}
                resetFilters={resetFilters}
              />
            ) : null}
          </CardContent>

          <CardContent>
            {data.length > 0 ? (
              <OrdersTable
                filteredData={filteredData}
                paginatedData={paginatedData}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                currentPage={currentPage}
                totalPages={totalPages}
                goToPage={goToPage}
              />
            ) : (
              <EmptyState
                title="No hay datos para mostrar"
                description="No se encontraron datos de pedidos. Intenta cargar un archivo CSV con datos de pedidos."
                handleFileUpload={handleFileUpload}
                fileUploading={fileUploading}
              />
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
};

// Export both components if needed elsewhere
export { OrdersFilterSection };
