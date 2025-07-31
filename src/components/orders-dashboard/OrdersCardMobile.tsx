import React, { useState, useMemo } from "react";
import {
  ShoppingCartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  Package,
  Eye,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  XCircleIcon,
  DownloadIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  llega_a_mexico?: string;
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

interface OrdersCardMobileProps {
  paginatedData: PedidoData[];
  filteredData: PedidoData[];
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  formatDate: (dateString?: string) => string;
  formatCurrency: (value: number, decimals?: number) => string;
  calculateRowData: (row: PedidoData) => {
    totalMxp: number;
    tCambio: number;
    gastosMxp: number;
    ddpTotalMxp: number;
    ddpMxpUnidad: number;
    ddpUsdUnidad: number;
    ddpUsdUnidadSIva: number;
  };
  onEditOrder: (orders: PedidoData[]) => void;
  loading?: boolean;
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
  handleExportPDF: () => void;
  isExporting: boolean;
}

export const OrdersCardMobile: React.FC<OrdersCardMobileProps> = ({
  paginatedData,
  filteredData,
  currentPage,
  totalPages,
  goToPage,
  formatDate,
  formatCurrency,
  calculateRowData,
  onEditOrder,
  loading = false,
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
  handleExportPDF,
  isExporting,
}) => {
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<PedidoData[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const hasData = filteredData.length > 0;

  // Validar si hay opciones disponibles
  const hasOrdenDeCompraOptions = ordenDeCompraOptions.length > 0;
  const hasTipoTelaOptions = tipoTelaOptions.length > 0;
  const hasColorOptions = colorOptions.length > 0;

  // Verificar si hay filtros activos
  const hasActiveFilters = searchQuery || 
    (ordenDeCompraFilter && ordenDeCompraFilter !== "all") ||
    (tipoTelaFilter && tipoTelaFilter !== "all") ||
    (colorFilter && colorFilter !== "all") ||
    (ubicacionFilter && ubicacionFilter !== "all");

  // Agrupar órdenes por orden_de_compra para mostrar una sola card por orden
  const groupedOrders = useMemo(() => {
    const groups: Record<string, PedidoData[]> = {};
    paginatedData.forEach(order => {
      const ordenCompra = order.orden_de_compra || 'Sin orden';
      if (!groups[ordenCompra]) {
        groups[ordenCompra] = [];
      }
      groups[ordenCompra].push(order);
    });
    return groups;
  }, [paginatedData]);

  return (
    <div className="space-y-4 px-4">
      {/* Sección de filtros móvil */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Header con título y botones */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-800">Filtros</span>
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {[searchQuery, ordenDeCompraFilter !== "all" ? "OC" : "", tipoTelaFilter !== "all" ? "Tela" : "", colorFilter !== "all" ? "Color" : "", ubicacionFilter !== "all" ? "Ubicación" : ""].filter(Boolean).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasActiveFilters && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={resetFilters}
                      className="h-8 w-8 p-0"
                    >
                      <XCircleIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Limpiar todos los filtros</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className="h-8 w-8 p-0"
            >
              {filtersCollapsed ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronUpIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Contenido colapsable */}
        {!filtersCollapsed && (
          <>
            {/* Búsqueda */}
            <div className="space-y-2">
          <Label htmlFor="search-mobile">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              id="search-mobile"
              type="text"
              placeholder="Buscar por proveedor, orden de compra, tipo de tela..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtros en grid móvil */}
        <div className="grid grid-cols-2 gap-3">
          {/* Orden de Compra */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="orden-compra-filter-mobile">OC</Label>
              {!hasOrdenDeCompraOptions && ordenDeCompraFilter !== "all" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AlertCircle size={14} className="text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>No hay OCs disponibles</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select value={ordenDeCompraFilter} onValueChange={setOrdenDeCompraFilter}>
              <SelectTrigger id="orden-compra-filter-mobile" className="w-full text-xs">
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

          {/* Tipo de Tela */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="tipo-tela-filter-mobile">Tela</Label>
              {!hasTipoTelaOptions && tipoTelaFilter !== "all" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AlertCircle size={14} className="text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>No hay telas disponibles</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select value={tipoTelaFilter} onValueChange={setTipoTelaFilter}>
              <SelectTrigger id="tipo-tela-filter-mobile" className="w-full text-xs">
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

          {/* Color */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="color-filter-mobile">Color</Label>
              {!hasColorOptions && colorFilter !== "all" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AlertCircle size={14} className="text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>No hay colores disponibles</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger id="color-filter-mobile" className="w-full text-xs">
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

          {/* Ubicación */}
          <div className="space-y-2">
            <Label htmlFor="ubicacion-filter-mobile">Ubicación</Label>
            <Select value={ubicacionFilter} onValueChange={setUbicacionFilter}>
              <SelectTrigger id="ubicacion-filter-mobile" className="w-full text-xs">
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

        {/* Filtros activos */}
        <div className="flex items-start gap-2 text-sm">
          <Filter size={16} className="text-gray-500 mt-0.5" />
          <div className="flex-1">
            <span className="text-gray-500 block mb-2">Filtros activos:</span>
            <div className="flex flex-wrap gap-2">
              {ordenDeCompraFilter && ordenDeCompraFilter !== "all" && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                  OC: {ordenDeCompraFilter}
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
            {/* Botón para limpiar filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="mt-2 h-8 px-2 text-xs"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
          </>
        )}

        {/* Separador y botón de descarga PDF */}
        <div className="border-t pt-4">
          <Button
            onClick={handleExportPDF}
            disabled={isExporting || !hasData}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white h-12"
            size="lg"
          >
            {isExporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <DownloadIcon className="h-5 w-5" />
            )}
            <span className="font-medium">
              {isExporting ? "Exportando..." : "Descargar PDF"}
            </span>
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="p-4 bg-blue-50 rounded-full mx-auto mb-4 w-fit">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Cargando órdenes de compra...</p>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">No se encontraron resultados para los filtros seleccionados</p>
        </div>
      ) : (
        <>
          {Object.entries(groupedOrders).map(([ordenCompra, orders], index) => {
            const firstOrder = orders[0]; // Usar el primer pedido para info general
            const totalTelas = orders.length;
            
            return (
              <div key={index} className="bg-white rounded-lg border shadow-sm p-4">
                {/* Header con orden de compra */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <ShoppingCartIcon className="h-5 w-5 text-blue-600" />
                    <span className="font-mono font-semibold text-base">
                      {ordenCompra}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {firstOrder?.Year || "N/A"}
                  </div>
                </div>

                {/* Información básica */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Proveedor:</span>
                    <span className="text-sm font-medium">{firstOrder?.proveedor || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Origen:</span>
                    <span className="text-sm font-medium">{firstOrder?.origen || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total de telas:</span>
                    <span className="text-sm font-medium text-blue-600">{totalTelas} tipo{totalTelas > 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedOrderDetails(orders);
                      setIsDetailsModalOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">Ver Detalles</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Modal de detalles */}
          <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
            <DialogContent className="max-w-4xl w-full max-h-[85vh] overflow-y-auto rounded-xl border shadow-lg">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="flex items-center gap-3 text-xl font-semibold">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ShoppingCartIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  {selectedOrderDetails[0]?.orden_de_compra || "Sin orden"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 pt-2">
                {/* Botones de acción en el header */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      onEditOrder(selectedOrderDetails);
                      setIsDetailsModalOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                  >
                    <EditIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Editar Orden</span>
                  </button>
                </div>

                {/* Información general de la orden */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h4 className="font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Información General
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-gray-600 text-xs font-medium uppercase tracking-wide">Proveedor</span>
                      <div className="font-semibold text-gray-800">{selectedOrderDetails[0]?.proveedor || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600 text-xs font-medium uppercase tracking-wide">Origen</span>
                      <div className="font-semibold text-gray-800">{selectedOrderDetails[0]?.origen || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600 text-xs font-medium uppercase tracking-wide">Año</span>
                      <div className="font-semibold text-gray-800">{selectedOrderDetails[0]?.Year || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-600 text-xs font-medium uppercase tracking-wide">Incoterm</span>
                      <div className="font-semibold text-gray-800">{selectedOrderDetails[0]?.incoterm || "-"}</div>
                    </div>
                  </div>
                </div>

                {/* Lista de todas las telas */}
                <div>
                  <h4 className="font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Detalle por Tela y Color ({selectedOrderDetails.length} tipos)
                  </h4>
                  <div className="space-y-4">
                    {selectedOrderDetails.map((order, index) => {
                      const calculatedData = calculateRowData(order);
                      return (
                        <div key={index} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                          {/* Header de la tela */}
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <Package className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <span className="font-semibold text-gray-800 text-base">
                                  {order["pedido_cliente.tipo_tela"] || "Sin tipo"}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-gray-500 text-sm">Color:</span>
                                  <span className="font-medium text-blue-600 text-sm">
                                    {order["pedido_cliente.color"] || "Sin color"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Detalles de producto y financiero */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                              <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Cantidad</div>
                              <div className="font-semibold text-gray-800">
                                {formatCurrency(Number(order["pedido_cliente.total_m_pedidos"]) || 0)} {order["pedido_cliente.unidad"] || "m"}
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                              <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Precio FOB USD</div>
                              <div className="font-semibold text-gray-800">
                                ${formatCurrency(Number(order.precio_m_fob_usd) || 0)}
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                              <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Total Factura</div>
                              <div className="font-semibold text-gray-800">
                                ${formatCurrency(Number(order.total_factura) || 0)}
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                              <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">DDP USD/Unidad</div>
                              <div className="font-semibold text-gray-800">
                                ${formatCurrency(calculatedData.ddpUsdUnidad)}
                              </div>
                            </div>
                          </div>

                          {/* Fechas y estado */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="space-y-1">
                              <span className="text-gray-600 text-xs font-medium uppercase tracking-wide">Fecha Pedido</span>
                              <div className="font-medium text-gray-800">{formatDate(order.fecha_pedido)}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-gray-600 text-xs font-medium uppercase tracking-wide">Llega a México</span>
                              <div className="font-medium text-gray-800">{formatDate(order.llega_a_mexico)}</div>
                            </div>
                          </div>

                          {/* Estado */}
                          <div className="flex justify-end">
                            {order.llega_almacen_proveedor ? (
                              <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300">
                                En Almacén
                              </span>
                            ) : order.sale_origen ? (
                              <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300">
                                En Tránsito
                              </span>
                            ) : (
                              <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300">
                                En Proveedor
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
            </DialogContent>
          </Dialog>

          {/* Paginación móvil */}
          {filteredData.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Página {currentPage} de {totalPages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-center text-xs text-gray-500 mt-2">
                Mostrando {((currentPage - 1) * 100) + 1}-{Math.min(currentPage * 100, filteredData.length)} de {filteredData.length} pedidos
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};