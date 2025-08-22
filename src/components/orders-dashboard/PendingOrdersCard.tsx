import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ClockIcon,
  RefreshCwIcon,
  EditIcon,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { EditOrderModal } from "./EditOrderModal";

interface OrderItem {
  num_archivo?: number | null;
  proveedor?: string | null;
  contacto?: string | null;
  email?: string | null;
  teléfono?: number | null;
  celular?: number | null;
  origen?: string | null;
  incoterm?: string | null;
  transportista?: string | null;
  agente_aduanal?: string | null;
  pedimento?: string | null;
  fecha_pedido?: string | null;
  sale_origen?: string | null;
  pago_credito?: string | null;
  "llega_a_Lazaro"?: string | null;
  "llega_a_Manzanillo"?: string | null;
  "llega_a_México"?: string | null;
  llega_almacen_proveedor?: string | null;
  factura_proveedor?: string | null;
  orden_de_compra?: string | null;
  reporte_inspeccion?: string | null;
  pedimento_tránsito?: string | null;
  "pedido_cliente.tipo_tela"?: string;
  "pedido_cliente.color"?: string;
  "pedido_cliente.total_m_pedidos"?: number;
  "pedido_cliente.unidad"?: string;
  precio_m_fob_usd?: number;
  total_x_color_fob_usd?: number;
  m_factura?: number | null;
  total_factura?: number | null;
  fraccion?: string | null;
  "supplier_percent_diff or upon negotiation"?: number | null;
  Year?: number | null;
  total_gastos?: number | null;
  tipo_de_cambio?: number | null;
  venta?: number | null;
  total_mxp?: number | null;
  t_cambio?: number | null;
  gastos_mxp?: number | null;
  ddp_total_mxp?: number | null;
  ddp_mxp_unidad?: number | null;
  ddp_usd_unidad?: number | null;
  ddp_usd_unidad_s_iva?: number | null;
  status?: string;
  [key: string]: string | number | null | undefined;
}

interface PendingOrder {
  orden_de_compra: string;
  proveedor: string | null;
  total_items: number;
  items: OrderItem[];
  fecha_creacion?: string;
  missing_fields: string[];
}

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
  status?: string;
  [key: string]: string | number | null | undefined;
}

interface PendingOrdersCardProps {
  isAdmin: boolean;
  onDataUpdate: () => void;
  data: PedidoData[];
  fetchPendingOrdersCount: () => Promise<void>;
  initialPendingCount?: number;
  pendingOrdersData: PendingOrder[];
}

export const PendingOrdersCard: React.FC<PendingOrdersCardProps> = ({
  isAdmin,
  onDataUpdate,
  data,
  fetchPendingOrdersCount,
  initialPendingCount = 0,
  pendingOrdersData,
}) => {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<PedidoData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [showInitialMessage, setShowInitialMessage] = useState(true);


  const checkPendingOrders = useCallback(async () => {
    if (!isAdmin) return;

    setIsLoading(true);
    setError(null);
    setShowInitialMessage(false);

    try {
      const response = await fetch("/api/orders/check-pending?refresh=true");

      if (!response.ok) {
        throw new Error(`Error al verificar órdenes pending: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      setPendingOrders(data.pendingOrders || []);
      setLastCheck(new Date());
      setHasInitialLoad(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      setError(errorMessage);
      toast.error("Error al verificar órdenes pendientes");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Initialize component state with data from props (no API calls)
  useEffect(() => {
    if (!isAdmin) return;

    // Use data from props instead of making API calls
    setPendingOrders(pendingOrdersData);
    setHasInitialLoad(true);
    setShowInitialMessage(false);
    
    if (pendingOrdersData.length > 0) {
      setLastCheck(new Date());
    }
  }, [isAdmin, pendingOrdersData]);

  useEffect(() => {
    const handleOrderUploadedEvent = async (event: Event) => {
      const customEvent = event as CustomEvent<{ fileName?: string }>;
      const fileName = customEvent.detail?.fileName || "archivo desconocido";

      toast.info(`🔄 Procesando ${fileName}...`, {
        duration: 3000,
      });

      setTimeout(() => {
        checkPendingOrders();
        fetchPendingOrdersCount(); // Update the count in parent component
      }, 2000);
    };

    window.addEventListener("order-uploaded", handleOrderUploadedEvent);

    return () => {
      window.removeEventListener("order-uploaded", handleOrderUploadedEvent);
    };
  }, [checkPendingOrders, fetchPendingOrdersCount]);

  const handleManualRefresh = () => {
    checkPendingOrders();
    fetchPendingOrdersCount(); // Update the count in parent component
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Fecha inválida";
    try {
      return new Date(dateString).toLocaleString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Fecha inválida";
    }
  };


  const handleCompleteOrder = (order: PendingOrder) => {
    // Convert OrderItem[] to PedidoData[] for EditOrderModal compatibility
    const convertedItems: PedidoData[] = order.items.map(item => ({
      num_archivo: item.num_archivo || undefined,
      proveedor: item.proveedor || undefined,
      contacto: item.contacto || undefined,
      origen: item.origen || undefined,
      incoterm: item.incoterm || undefined,
      orden_de_compra: order.orden_de_compra,
      transportista: item.transportista || undefined,
      agente_aduanal: item.agente_aduanal || undefined,
      pedimento: item.pedimento || undefined,
      fecha_pedido: item.fecha_pedido || undefined,
      sale_origen: item.sale_origen || undefined,
      pago_credito: item.pago_credito || undefined,
      llega_a_mexico: item["llega_a_México"] || undefined,
      llega_almacen_proveedor: item.llega_almacen_proveedor || undefined,
      factura_proveedor: item.factura_proveedor || undefined,
      reporte_inspeccion: item.reporte_inspeccion || undefined,
      pedimento_tránsito: item.pedimento_tránsito || undefined,
      m_factura: item.m_factura || undefined,
      total_factura: item.total_factura || undefined,
      tipo_de_cambio: item.tipo_de_cambio || undefined,
      venta: item.venta || undefined,
      "pedido_cliente.tipo_tela": item["pedido_cliente.tipo_tela"] || "",
      "pedido_cliente.color": item["pedido_cliente.color"] || "",
      "pedido_cliente.total_m_pedidos": item["pedido_cliente.total_m_pedidos"] || 0,
      "pedido_cliente.unidad": item["pedido_cliente.unidad"] || "m",
      precio_m_fob_usd: item.precio_m_fob_usd || 0,
      total_x_color_fob_usd: item.total_x_color_fob_usd || 0,
      Year: item.Year || undefined,
      total_gastos: item.total_gastos || undefined,
    }));

    setSelectedOrder(order);
    setSelectedOrderItems(convertedItems);
    setIsEditModalOpen(true);
  };

  const handleSaveOrder = async (updatedOrders: PedidoData[]) => {
    const ordenDeCompra = selectedOrder?.orden_de_compra;
    
    try {
      const response = await fetch("/api/orders/save-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orders: updatedOrders,
          orden_de_compra: ordenDeCompra,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar las órdenes");
      }

      await response.json();

      toast.success(
        `Orden ${ordenDeCompra} completada exitosamente`
      );

      setIsEditModalOpen(false);
      setSelectedOrder(null);
      setSelectedOrderItems([]);

      // Actualizar inmediatamente sin timeout
      if (ordenDeCompra) {
        // 1. Remover de la lista local inmediatamente
        setPendingOrders(prevOrders => 
          prevOrders.filter(order => order.orden_de_compra !== ordenDeCompra)
        );
        
        // 2. Refresh inmediato de la API de pending orders
        await checkPendingOrders();
        
        // 3. Actualizar el componente padre
        await onDataUpdate();
        
        // 4. Actualizar contador
        fetchPendingOrdersCount();
      }
    } catch {
      toast.error("Error al guardar los datos de la orden");
    }
  };

  if (!isAdmin) {
    return null;
  }


  const totalItems = pendingOrders.reduce(
    (sum, order) => sum + order.total_items,
    0
  );

  return (
    <>
      <Card className="mb-6 border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ClockIcon className="mr-2 h-5 w-5 text-orange-600" />
              <div>
                <CardTitle className="text-orange-800">
                  Órdenes de Compra Pendientes
                </CardTitle>
                <CardDescription className="text-orange-600">
                  {isLoading && !hasInitialLoad 
                    ? "Verificando órdenes pendientes..." 
                    : error
                    ? "Error al cargar órdenes pendientes"
                    : showInitialMessage && initialPendingCount > 0
                    ? `${initialPendingCount} orden${initialPendingCount !== 1 ? "es" : ""} pendiente${initialPendingCount !== 1 ? "s" : ""} encontrada${initialPendingCount !== 1 ? "s" : ""} - Haz clic en actualizar para ver detalles`
                    : showInitialMessage && initialPendingCount === 0
                    ? "No hay órdenes pendientes - Haz clic en actualizar para verificar"
                    : pendingOrders.length === 0
                    ? "No hay órdenes pendientes en este momento"
                    : `${pendingOrders.length} orden${pendingOrders.length !== 1 ? "es" : ""} con ${totalItems} item${totalItems !== 1 ? "s" : ""} que necesitan completar datos`
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleManualRefresh}
                      disabled={isLoading}
                      className="border-orange-300 hover:bg-orange-100"
                    >
                      {isLoading ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Verificar órdenes pending manualmente</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          {lastCheck && (
            <p className="text-xs text-orange-500 mt-2">
              Última verificación: {formatDate(lastCheck.toISOString())}
            </p>
          )}
        </CardHeader>

        <CardContent>
          {/* Loading State */}
          {isLoading && !hasInitialLoad && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <Loader2Icon className="h-6 w-6 animate-spin text-orange-600" />
                <p className="text-sm text-orange-600">Verificando órdenes pendientes...</p>
              </div>
            </div>
          )}

          {/* Initial State - Show when no data has been loaded yet */}
          {showInitialMessage && !isLoading && !hasInitialLoad && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <ClockIcon className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-orange-700 mb-1">
                    {initialPendingCount > 0 
                      ? `${initialPendingCount} orden${initialPendingCount !== 1 ? "es" : ""} pendiente${initialPendingCount !== 1 ? "s" : ""} detectada${initialPendingCount !== 1 ? "s" : ""}`
                      : "Verificar órdenes pendientes"
                    }
                  </p>
                  <p className="text-xs text-orange-600 mb-3">
                    {initialPendingCount > 0 
                      ? "Haz clic en el botón actualizar para ver los detalles"
                      : "Haz clic en el botón actualizar para verificar si hay órdenes pendientes"
                    }
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    className="border-orange-300 hover:bg-orange-100"
                  >
                    <RefreshCwIcon className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && hasInitialLoad && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircleIcon className="h-6 w-6 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">Error al cargar órdenes pendientes</p>
                  <p className="text-xs text-red-600">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    className="mt-2"
                    disabled={isLoading}
                  >
                    Reintentar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && hasInitialLoad && pendingOrders.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <ClockIcon className="h-6 w-6 text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-orange-700 mb-1">No hay órdenes pendientes</p>
                  <p className="text-xs text-orange-600">Todas las órdenes están completas</p>
                </div>
              </div>
            </div>
          )}

          {/* Orders List */}
          {!isLoading && !error && pendingOrders.length > 0 && (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.orden_de_compra}
                  className="flex items-center justify-between p-4 bg-white border border-orange-200 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {order.orden_de_compra}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompleteOrder(order)}
                            className="flex items-center gap-2"
                          >
                            <EditIcon className="h-4 w-4" />
                            Completar Datos
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Completar los datos faltantes de esta orden
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOrder && (
        <EditOrderModal
          data={data}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedOrder(null);
            setSelectedOrderItems([]);
          }}
          onSave={handleSaveOrder}
          preselectedOrders={selectedOrderItems}
          isPendingOrder={true}
          onDataRefresh={handleManualRefresh}
        >
          <span />
        </EditOrderModal>
      )}
    </>
  );
};