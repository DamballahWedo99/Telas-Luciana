import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ShoppingCartIcon,
  XCircleIcon,
  Search,
  Filter,
  AlertCircle,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  DownloadIcon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { EditOrderModal } from "./EditOrderModal";

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
          <table className="w-full text-sm border-collapse min-w-[4000px]">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[180px]">
                  Orden de Compra
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[150px]">
                  Proveedor
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Contacto
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[150px]">
                  Email
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[100px]">
                  Origen
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Incoterm
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Transportista
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Agente Aduanal
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Pedimento
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[180px]">
                  Tipo de Tela
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Color
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[100px]">
                  M Pedidos
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[80px]">
                  Unidad
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Precio FOB USD
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Total Factura (USD)
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[100px]">
                  M Factura
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Tipo Cambio
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Total MXP
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Total Gastos
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
                  Factura Proveedor
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[100px]">
                  Fracción
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[80px]">
                  Año
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[100px]">
                  Venta
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
                    colSpan={33}
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
                        {row.proveedor || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.contacto || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.email || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.origen || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.incoterm || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.transportista || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.agente_aduanal || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.pedimento || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row["pedido_cliente.tipo_tela"] || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row["pedido_cliente.color"] || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {formatCurrency(row["pedido_cliente.total_m_pedidos"] || 0)}
                      </td>
                      <td className="p-2 align-middle">
                        {row["pedido_cliente.unidad"] || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(row.precio_m_fob_usd || 0)}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(row.total_factura || 0)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatCurrency(row.m_factura || 0)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatCurrency(row.tipo_de_cambio || 0)}
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.totalMxp)}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(row.total_gastos || 0)}
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
                        {row.factura_proveedor || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.fraccion || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row.Year || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(row.venta || 0)}
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
  resetFilters: () => void;
  formatDate: (dateString?: string) => string;
  formatCurrency: (value: number, decimals?: number) => string;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  ordersCollapsed: boolean;
  setOrdersCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  onDataUpdate?: () => void;
  loading?: boolean;
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
  resetFilters,
  formatDate,
  formatCurrency,
  currentPage,
  totalPages,
  goToPage,
  ordersCollapsed,
  setOrdersCollapsed,
  onDataUpdate,
  loading = false,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSaveOrder = async (updatedOrders: PedidoData[]) => {
    try {
      let totalFilesUpdated = 0;
      
      // Procesar cada orden individualmente
      for (const updatedOrder of updatedOrders) {
        const response = await fetch("/api/s3/pedidos", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ updatedOrder }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al guardar el pedido");
        }

        const result = await response.json();
        totalFilesUpdated += result.filesUpdated || 0;
      }

      // Mostrar toast de éxito
      toast.success(`Pedidos actualizados exitosamente`, {
        description: `${updatedOrders.length} telas actualizadas en ${totalFilesUpdated} archivo(s)`,
        duration: 3000,
      });
      
      // Actualizar datos sin refrescar la página
      if (onDataUpdate) {
        onDataUpdate();
      }
      
      console.log(`✅ ${updatedOrders.length} telas guardadas en ${totalFilesUpdated} archivos`);
    } catch (error) {
      console.error("❌ Error guardando pedidos:", error);
      
      // Mostrar toast de error
      toast.error("Error al guardar los pedidos", {
        description: error instanceof Error ? error.message : "Error desconocido",
        duration: 5000,
      });
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

  const calculateRowData = (row: PedidoData) => {
    const ordenDeCompra = row.orden_de_compra || "";
    const totalFactura = row.total_factura || 0;
    const tipoDeCambio = row.tipo_de_cambio || 0;
    const totalGastos = row.total_gastos || 0;
    const mFactura = row.m_factura || 1;

    const totalMxp = totalFactura * tipoDeCambio;

    const ordenGroups: Record<string, { totalMxpSum: number }> = {};
    filteredData.forEach((r) => {
      const oc = r.orden_de_compra || "";
      const tf = r.total_factura || 0;
      const tc = r.tipo_de_cambio || 0;
      const tm = tf * tc;
      if (!ordenGroups[oc]) {
        ordenGroups[oc] = { totalMxpSum: 0 };
      }
      ordenGroups[oc].totalMxpSum += tm;
    });

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

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredData.map((row) => {
        const calculatedData = calculateRowData(row);
        return {
          "Orden de Compra": row.orden_de_compra || "-",
          "Proveedor": row.proveedor || "-",
          "Contacto": row.contacto || "-",
          "Email": row.email || "-",
          "Origen": row.origen || "-",
          "Incoterm": row.incoterm || "-",
          "Transportista": row.transportista || "-",
          "Agente Aduanal": row.agente_aduanal || "-",
          "Pedimento": row.pedimento || "-",
          "Tipo de Tela": row["pedido_cliente.tipo_tela"] || "-",
          "Color": row["pedido_cliente.color"] || "-",
          "M Pedidos": formatCurrency(row["pedido_cliente.total_m_pedidos"] || 0),
          "Unidad": row["pedido_cliente.unidad"] || "-",
          "Precio FOB USD": `$${formatCurrency(row.precio_m_fob_usd || 0)}`,
          "Total Factura (USD)": `$${formatCurrency(row.total_factura || 0)}`,
          "M Factura": formatCurrency(row.m_factura || 0),
          "Tipo Cambio": formatCurrency(row.tipo_de_cambio || 0),
          "Total MXP": `$MXN ${formatCurrency(calculatedData.totalMxp)}`,
          "Total Gastos": `$${formatCurrency(row.total_gastos || 0)}`,
          "T. Cambio": `${(calculatedData.tCambio * 100).toFixed(2)}%`,
          "Gastos MXP": `$MXN ${formatCurrency(calculatedData.gastosMxp)}`,
          "DDP Total MXP": `$MXN ${formatCurrency(calculatedData.ddpTotalMxp)}`,
          "DDP MXP/Unidad": `$MXN ${formatCurrency(calculatedData.ddpMxpUnidad)}`,
          "DDP USD/Unidad": `$${formatCurrency(calculatedData.ddpUsdUnidad)}`,
          "DDP USD/Unidad S/IVA": `$${formatCurrency(calculatedData.ddpUsdUnidadSIva)}`,
          "Factura Proveedor": row.factura_proveedor || "-",
          "Fracción": row.fraccion || "-",
          "Año": row.Year || "-",
          "Venta": `$${formatCurrency(row.venta || 0)}`,
          "Fecha Pedido": formatDate(row.fecha_pedido),
          "Sale Origen": formatDate(row.sale_origen),
          "Llega a Lázaro": formatDate(row.llega_a_Lazaro),
          "Llega a Manzanillo": formatDate(row.llega_a_Manzanillo),
          "Llega Almacén": formatDate(row.llega_almacen_proveedor),
        };
      });

      const csv = Papa.unparse(dataToExport);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `ordenes-compra-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Archivo CSV exportado exitosamente");
    } catch (error) {
      console.error("Error exportando CSV:", error);
      toast.error("Error al exportar el archivo CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      doc.setFontSize(16);
      doc.text("Reporte de Órdenes de Compra", 14, 15);
      doc.setFontSize(10);
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 14, 22);
      doc.text(`Total de pedidos: ${filteredData.length}`, 14, 28);

      const tableData = filteredData.map((row) => {
        const calculatedData = calculateRowData(row);
        return [
          row.orden_de_compra || "-",
          row.proveedor || "-",
          row["pedido_cliente.tipo_tela"] || "-",
          row["pedido_cliente.color"] || "-",
          formatCurrency(row["pedido_cliente.total_m_pedidos"] || 0),
          row["pedido_cliente.unidad"] || "-",
          `$${formatCurrency(row.precio_m_fob_usd || 0)}`,
          `$${formatCurrency(row.total_factura || 0)}`,
          formatCurrency(row.tipo_de_cambio || 0),
          `$MXN ${formatCurrency(calculatedData.totalMxp)}`,
          `$MXN ${formatCurrency(calculatedData.ddpTotalMxp)}`,
          formatDate(row.fecha_pedido),
          formatDate(row.llega_almacen_proveedor),
        ];
      });

      autoTable(doc, {
        head: [[
          "OC",
          "Proveedor",
          "Tipo Tela",
          "Color",
          "M Pedidos",
          "Unidad",
          "Precio FOB",
          "Total Factura",
          "Tipo Cambio",
          "Total MXP",
          "DDP Total MXP",
          "Fecha Pedido",
          "Llega Almacén",
        ]],
        body: tableData,
        startY: 35,
        styles: {
          fontSize: 6,
          cellPadding: 1,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontSize: 7,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { top: 35, right: 14, bottom: 20, left: 14 },
      });

      doc.save(`ordenes-compra-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Archivo PDF exportado exitosamente");
    } catch (error) {
      console.error("Error exportando PDF:", error);
      toast.error("Error al exportar el archivo PDF");
    } finally {
      setIsExporting(false);
    }
  };

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

            <EditOrderModal
              data={data}
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              onSave={handleSaveOrder}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <EditIcon className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Editar Orden de Compra</p>
                </TooltipContent>
              </Tooltip>
            </EditOrderModal>

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
          {loading ? (
            <CardContent className="pt-0 pb-4">
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                  <div className="text-lg font-semibold text-gray-600">
                    Cargando datos históricos...
                  </div>
                </div>
              </div>
            </CardContent>
          ) : (
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
                    resetFilters={resetFilters}
                  />
                ) : null}
              </CardContent>

              <CardContent>
                <OrdersTable
                  filteredData={filteredData}
                  paginatedData={paginatedData}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  goToPage={goToPage}
                />
              </CardContent>
            </>
          )}
        </>
      )}
    </Card>
  );
};

export { OrdersFilterSection };
