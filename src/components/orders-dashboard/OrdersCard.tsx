import React, { useRef, useMemo, useEffect } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  Upload,
  Loader2,
  ShoppingCartIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OrdersFilterSection } from "./OrdersFilterSection";
import { OrdersTable } from "./OrdersTable";
import { EmptyState } from "./EmptyState";

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
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Limpiar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Restablecer todos los filtros</p>
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
        <CardContent>
          {data.length > 0 ? (
            <>
              {/* Filters */}
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

              {/* Data Table */}
              <OrdersTable
                filteredData={filteredData}
                paginatedData={paginatedData}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                currentPage={currentPage}
                totalPages={totalPages}
                goToPage={goToPage}
              />
            </>
          ) : (
            <EmptyState
              title="No hay datos para mostrar"
              description="No se encontraron datos de pedidos. Intenta cargar un archivo CSV con datos de pedidos."
              handleFileUpload={handleFileUpload}
              fileUploading={fileUploading}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
};
