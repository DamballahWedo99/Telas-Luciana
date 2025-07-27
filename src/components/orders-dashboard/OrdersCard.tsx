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
  ChevronLeftIcon,
  ChevronRightIcon,
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { EmptyState } from "./EmptyState";

interface PedidoData {
  num_archivo?: number;
  proveedor?: string;
  contacto?: string;
  email?: string;
  teléfono?: number;
  celular?: number;
  origen?: string;
  incoterm?: string;
  transportista?: string;
  agente_aduanal?: string;
  pedimento?: string;
  fecha_pedido?: string;
  sale_origen?: string;
  pago_credito?: string | null;
  llega_a_Lazaro?: string;
  llega_a_Manzanillo?: string;
  llega_almacen_proveedor?: string;
  factura_proveedor?: string;
  orden_de_compra?: string;
  reporte_inspeccion?: string | null;
  pedimento_tránsito?: string | null;
  "pedido_cliente.tipo_tela"?: string;
  "pedido_cliente.color"?: string;
  "pedido_cliente.total_m_pedidos"?: number;
  "pedido_cliente.unidad"?: string;
  precio_m_fob_usd?: number;
  total_x_color_fob_usd?: number;
  m_factura?: number;
  total_factura?: number;
  fraccion?: string;
  "supplier_percent_diff or upon negotiation"?: number;
  Year?: number;
  total_gastos?: number;
  tipo_de_cambio?: number;
  venta?: number;
  total_mxp?: number;
  t_cambio?: number;
  gastos_mxp?: number;
  ddp_total_mxp?: number;
  ddp_mxp_unidad?: number;
  ddp_usd_unidad?: number;
  ddp_usd_unidad_s_iva?: number;
  [key: string]: string | number | null | undefined;
}

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
}) => {
  const hasOrdenDeCompraOptions = ordenDeCompraOptions.length > 0;
  const hasTipoTelaOptions = tipoTelaOptions.length > 0;
  const hasColorOptions = colorOptions.length > 0;

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

const OrdersTable: React.FC<{
  filteredData: PedidoData[];
  paginatedData: PedidoData[];
  formatDate: (dateString?: string) => string;
  formatCurrency: (value: number, decimals?: number) => string;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
}> = ({
  filteredData,
  paginatedData,
  formatDate,
  formatCurrency,
  currentPage,
  totalPages,
  goToPage,
}) => {
  const getPageNumbers = () => {
    const pages = [];

    pages.push(1);

    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      if (i === 2 && currentPage > 3) {
        pages.push("ellipsis1");
      } else if (i === totalPages - 1 && currentPage < totalPages - 2) {
        pages.push("ellipsis2");
      } else {
        pages.push(i);
      }
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return Array.from(new Set(pages));
  };

  const hasData = paginatedData && paginatedData.length > 0;

  const calculateOrdenGroups = () => {
    const ordenGroups: Record<string, { totalMxpSum: number }> = {};

    filteredData.forEach((row) => {
      const ordenDeCompra = row.orden_de_compra || "";
      const totalFactura = row.total_factura || 0;
      const tipoDeCambio = row.tipo_de_cambio || 0;
      const totalMxp = totalFactura * tipoDeCambio;

      if (!ordenGroups[ordenDeCompra]) {
        ordenGroups[ordenDeCompra] = {
          totalMxpSum: 0,
        };
      }
      ordenGroups[ordenDeCompra].totalMxpSum += totalMxp;
    });

    return ordenGroups;
  };

  const ordenGroups = calculateOrdenGroups();

  const calculateRowData = (row: PedidoData) => {
    const ordenDeCompra = row.orden_de_compra || "";
    const totalFactura = row.total_factura || 0;
    const tipoDeCambio = row.tipo_de_cambio || 0;
    const totalGastos = row.total_gastos || 0;
    const mFactura = row.m_factura || 1;

    const totalMxp = totalFactura * tipoDeCambio;

    const totalMxpSum = ordenGroups[ordenDeCompra]?.totalMxpSum || 1;

    const tCambio = totalMxpSum > 0 ? totalMxp / totalMxpSum : 0;

    const gastosMxp = tCambio * totalGastos;

    const ddpTotalMxp = gastosMxp + totalMxp;

    const ddpMxpUnidad = mFactura > 0 ? ddpTotalMxp / mFactura : 0;

    const ddpUsdUnidad = tipoDeCambio > 0 ? ddpMxpUnidad / tipoDeCambio : 0;

    const ddpUsdUnidadSIva = ddpUsdUnidad / 1.16;

    return {
      totalMxp,
      tCambio,
      gastosMxp,
      ddpTotalMxp,
      ddpMxpUnidad,
      ddpUsdUnidad,
      ddpUsdUnidadSIva,
    };
  };

  return (
    <div className="bg-white rounded shadow-sm mb-6">
      <div className="border rounded-md overflow-hidden">
        <div className="h-[500px] overflow-auto relative">
          <table className="w-full text-sm border-collapse min-w-[2500px]">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[180px]">
                  Orden de Compra
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[180px]">
                  Tipo de Tela
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Color
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Total Factura (USD)
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Total MXP
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[100px]">
                  T. Cambio
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Gastos MXP
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  DDP Total MXP
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  DDP MXP/Unidad
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  DDP USD/Unidad
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[160px]">
                  DDP USD/Unidad S/IVA
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Fecha Pedido
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Sale Origen
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Llega a Lázaro
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Llega a Manzanillo
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Llega Almacén
                </th>
              </tr>
            </thead>
            <tbody>
              {!hasData ? (
                <tr>
                  <td
                    colSpan={16}
                    className="p-2 align-middle text-center h-24"
                  >
                    No se encontraron resultados para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => {
                  const calculatedData = calculateRowData(row);

                  return (
                    <tr
                      key={index}
                      className={`border-b transition-colors hover:bg-muted/50 ${
                        index % 2 === 0 ? "" : "bg-gray-50"
                      }`}
                    >
                      <td className="p-2 align-middle font-medium">
                        {row.orden_de_compra || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row["pedido_cliente.tipo_tela"] || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row["pedido_cliente.color"] || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(row.total_factura || 0)}
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.totalMxp)}
                      </td>
                      <td className="p-2 align-middle">
                        {(calculatedData.tCambio * 100).toFixed(2)}%
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.gastosMxp)}
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.ddpTotalMxp)}
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.ddpMxpUnidad)}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(calculatedData.ddpUsdUnidad)}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(calculatedData.ddpUsdUnidadSIva)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.fecha_pedido)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.sale_origen)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.llega_a_Lazaro)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.llega_a_Manzanillo)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.llega_almacen_proveedor)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredData.length > 0 && (
        <div className="py-4 border-t border-gray-200 bg-white flex justify-center">
          <div className="flex items-center gap-4">
            {currentPage > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 py-2 rounded-md"
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Atrás
              </Button>
            )}

            <Pagination>
              <PaginationContent>
                {getPageNumbers().map((page, i) => (
                  <PaginationItem key={i}>
                    {page === "ellipsis1" || page === "ellipsis2" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(page as number);
                        }}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
              </PaginationContent>
            </Pagination>

            {currentPage < totalPages && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 py-2 rounded-md"
                onClick={() => goToPage(currentPage + 1)}
              >
                Siguiente
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

  const isFilterActive =
    searchQuery !== "" ||
    ordenDeCompraFilter !== "all" ||
    tipoTelaFilter !== "all" ||
    colorFilter !== "all" ||
    ubicacionFilter !== "all";

  const filteredOptions = useMemo(() => {
    const getFilteredOrdenDeCompraOptions = (): string[] => {
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
        const ubicacionField =
          ubicacionFilter === "almacen"
            ? "llega_almacen_proveedor"
            : ubicacionFilter === "transito"
            ? "llega_a_Lazaro"
            : "fecha_pedido";

        filtered = filtered.filter((item) => item[ubicacionField]);
      }

      return [...new Set(filtered.map((item) => item.orden_de_compra))].filter(
        (value): value is string => typeof value === "string" && value !== ""
      );
    };

    const getFilteredTipoTelaOptions = (): string[] => {
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
            : "fecha_pedido";

        filtered = filtered.filter((item) => item[ubicacionField]);
      }

      return [
        ...new Set(filtered.map((item) => item["pedido_cliente.tipo_tela"])),
      ].filter(
        (value): value is string => typeof value === "string" && value !== ""
      );
    };

    const getFilteredColorOptions = (): string[] => {
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
            : "fecha_pedido";

        filtered = filtered.filter((item) => item[ubicacionField]);
      }

      return [
        ...new Set(filtered.map((item) => item["pedido_cliente.color"])),
      ].filter(
        (value): value is string => typeof value === "string" && value !== ""
      );
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

export { OrdersFilterSection };
