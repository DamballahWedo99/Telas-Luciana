import React, { useState, useEffect } from "react";
import { editOrderSchema, editTelaSchema } from "@/lib/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SaveIcon, XIcon } from "lucide-react";

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

interface EditOrderModalProps {
  data: PedidoData[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedOrders: PedidoData[]) => void;
  children: React.ReactNode;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  data,
  isOpen,
  onClose,
  onSave,
  children,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [editingOrder, setEditingOrder] = useState<PedidoData | null>(null);
  const [orderTelas, setOrderTelas] = useState<PedidoData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [telaValidationErrors, setTelaValidationErrors] = useState<Record<number, Record<string, string>>>({});

  // Opciones hardcodeadas para los selects
  const proveedorOptions = [
    "HYWELL / GALAXY",
    "SUNSHINE TEXTILE",
    "DRAGON TEXTILES",
    "GOLDEN FABRIC",
    "OCEAN MILLS",
  ];

  const incotermOptions = [
    "FOB SHANGHAI",
    "FOB NINGBO",
    "FOB QINGDAO", 
    "CIF MANZANILLO",
    "EXW",
  ];

  const transportistaOptions = [
    "DICUPA",
    "MAERSK",
    "COSCO",
    "EVERGREEN",
    "MSC",
  ];

  // Obtener órdenes únicas
  const uniqueOrders = Array.from(
    new Set(data.map((item) => item.orden_de_compra))
  ).filter((value): value is string => typeof value === "string" && value !== "");

  // Filtrar órdenes basado en la búsqueda
  const filteredOrders = uniqueOrders.filter((order) =>
    order.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (selectedOrderId) {
      // Obtener todas las telas asociadas a esta orden de compra
      const relatedTelas = data.filter((item) => item.orden_de_compra === selectedOrderId);
      setOrderTelas(relatedTelas);
      
      // Seleccionar la primera como orden base para datos generales
      if (relatedTelas.length > 0) {
        setEditingOrder({ ...relatedTelas[0] });
      }
    } else {
      setEditingOrder(null);
      setOrderTelas([]);
    }
  }, [selectedOrderId, data]);


  const handleInputChange = (field: keyof PedidoData, value: string | number) => {
    if (editingOrder) {
      setEditingOrder({
        ...editingOrder,
        [field]: value,
      });
    }
  };

  const handleTelaChange = (telaIndex: number, field: keyof PedidoData, value: string | number) => {
    // Limpiar errores de validación para este campo específico
    setTelaValidationErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[telaIndex]) {
        delete newErrors[telaIndex][field.toString()];
        if (Object.keys(newErrors[telaIndex]).length === 0) {
          delete newErrors[telaIndex];
        }
      }
      return newErrors;
    });
    
    setOrderTelas(prev => prev.map((tela, index) => 
      index === telaIndex 
        ? { ...tela, [field]: value }
        : tela
    ));
  };

  // Orden correcto de los campos según la estructura original
  const fieldOrder = [
    'num_archivo',
    'proveedor',
    'contacto',
    'email',
    'teléfono',
    'celular',
    'origen',
    'incoterm',
    'transportista',
    'agente_aduanal',
    'pedimento',
    'fecha_pedido',
    'sale_origen',
    'pago_credito',
    'llega_a_Lazaro',
    'llega_a_Manzanillo',
    'llega_almacen_proveedor',
    'factura_proveedor',
    'orden_de_compra',
    'reporte_inspeccion',
    'pedimento_tránsito',
    'pedido_cliente.tipo_tela',
    'pedido_cliente.color',
    'pedido_cliente.total_m_pedidos',
    'pedido_cliente.unidad',
    'precio_m_fob_usd',
    'total_x_color_fob_usd',
    'm_factura',
    'total_factura',
    'fraccion',
    'supplier_percent_diff or upon negotiation',
    'Year',
    'total_gastos',
    'tipo_de_cambio',
    'venta'
  ];

  // Función para limpiar campos calculados y reordenar según estructura original
  const cleanAndReorderData = (order: PedidoData): PedidoData => {
    const fieldsToRemove = [
      'total_mxp',
      't_cambio', 
      'gastos_mxp',
      'ddp_total_mxp',
      'ddp_mxp_unidad',
      'ddp_usd_unidad',
      'ddp_usd_unidad_s_iva'
    ];
    
    // Crear objeto limpio sin campos calculados
    const cleanOrder = { ...order };
    fieldsToRemove.forEach(field => {
      delete cleanOrder[field];
    });
    
    // Reordenar campos según el orden correcto
    const reorderedOrder: PedidoData = {};
    
    // Primero agregar campos en el orden correcto
    fieldOrder.forEach(field => {
      if (cleanOrder[field] !== undefined) {
        reorderedOrder[field] = cleanOrder[field];
      }
    });
    
    // Agregar cualquier campo adicional que no esté en el orden predefinido
    Object.keys(cleanOrder).forEach(field => {
      if (!fieldOrder.includes(field) && reorderedOrder[field] === undefined) {
        reorderedOrder[field] = cleanOrder[field];
      }
    });
    
    return reorderedOrder;
  };

  const handleSave = async () => {
    if (!editingOrder || orderTelas.length === 0) return;

    setValidationErrors({});
    setTelaValidationErrors({});
    
    // Validar los datos con Zod
    const validationData = {
      proveedor: editingOrder.proveedor || "",
      incoterm: editingOrder.incoterm || "",
      transportista: editingOrder.transportista || "",
      agente_aduanal: editingOrder.agente_aduanal || "",
      fecha_pedido: editingOrder.fecha_pedido || "",
      sale_origen: editingOrder.sale_origen || "",
      pago_credito: editingOrder.pago_credito || "",
      llega_a_Lazaro: editingOrder.llega_a_Lazaro || "",
      llega_a_Manzanillo: editingOrder.llega_a_Manzanillo || "",
      llega_almacen_proveedor: editingOrder.llega_almacen_proveedor || "",
      pedimento: editingOrder.pedimento || "",
      factura_proveedor: editingOrder.factura_proveedor || "",
      reporte_inspeccion: editingOrder.reporte_inspeccion || "",
      pedimento_tránsito: editingOrder.pedimento_tránsito || "",
      precio_m_fob_usd: editingOrder.precio_m_fob_usd || 0,
      tipo_de_cambio: editingOrder.tipo_de_cambio || 0,
      venta: editingOrder.venta || 0,
    };

    const validation = editOrderSchema.safeParse(validationData);
    
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        if (error.path.length > 0) {
          errors[error.path[0].toString()] = error.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    // Validar las telas individuales
    const telaErrors: Record<number, Record<string, string>> = {};
    let hasTelaErrors = false;

    orderTelas.forEach((tela, index) => {
      const telaData = {
        venta: tela.venta || 0,
        m_factura: tela.m_factura || 0,
        total_factura: tela.total_factura || 0,
      };

      const telaValidation = editTelaSchema.safeParse(telaData);
      
      if (!telaValidation.success) {
        const errors: Record<string, string> = {};
        telaValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
        if (Object.keys(errors).length > 0) {
          telaErrors[index] = errors;
          hasTelaErrors = true;
        }
      }
    });

    if (hasTelaErrors) {
      setTelaValidationErrors(telaErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Aplicar cambios generales a todas las telas de la orden y limpiar campos calculados
      const updatedTelas = orderTelas.map(tela => {
        const updatedTela = {
          ...tela,
          // Campos generales que se aplican a toda la orden
          proveedor: editingOrder.proveedor,
          incoterm: editingOrder.incoterm,
          transportista: editingOrder.transportista,
          agente_aduanal: editingOrder.agente_aduanal,
          fecha_pedido: editingOrder.fecha_pedido,
          sale_origen: editingOrder.sale_origen,
          pago_credito: editingOrder.pago_credito,
          llega_a_Lazaro: editingOrder.llega_a_Lazaro,
          llega_a_Manzanillo: editingOrder.llega_a_Manzanillo,
          llega_almacen_proveedor: editingOrder.llega_almacen_proveedor,
          pedimento: editingOrder.pedimento,
          factura_proveedor: editingOrder.factura_proveedor,
          reporte_inspeccion: editingOrder.reporte_inspeccion,
          pedimento_tránsito: editingOrder.pedimento_tránsito,
          precio_m_fob_usd: editingOrder.precio_m_fob_usd,
          tipo_de_cambio: editingOrder.tipo_de_cambio,
        };
        
        // Limpiar campos calculados y reordenar antes de enviar
        return cleanAndReorderData(updatedTela);
      });

      // Guardar todas las telas actualizadas de una vez
      await onSave(updatedTelas);

      onClose();
      setSelectedOrderId("");
      setEditingOrder(null);
      setOrderTelas([]);
      setSearchQuery("");
      setValidationErrors({});
      setTelaValidationErrors({});
    } catch (error) {
      console.error("Error saving order:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSearchQuery(orderId);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Si el valor coincide exactamente con una orden, seleccionarla
    if (uniqueOrders.includes(value)) {
      setSelectedOrderId(value);
    } else {
      setSelectedOrderId("");
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedOrderId("");
    setEditingOrder(null);
    setOrderTelas([]);
    setSearchQuery("");
    setValidationErrors({});
    setTelaValidationErrors({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Orden de Compra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selector de Orden de Compra */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Orden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campo de búsqueda */}
              <div className="space-y-2">
                <Label htmlFor="order-search">Buscar Orden de Compra</Label>
                <Input
                  id="order-search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Escribe para buscar una orden de compra..."
                  className="w-full"
                />
              </div>
              
              {/* Separador */}
              <Separator />
              
              {/* Lista de órdenes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Órdenes Disponibles ({filteredOrders.length})
                </Label>
                <ScrollArea className="h-32 w-full rounded-md border">
                  <div className="p-2 space-y-1">
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((orden) => (
                        <div
                          key={orden}
                          className={`relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
                            selectedOrderId === orden
                              ? 'bg-accent text-accent-foreground font-medium'
                              : ''
                          }`}
                          onClick={() => handleOrderSelect(orden)}
                        >
                          {orden}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                        {searchQuery.length > 0 
                          ? "No se encontraron órdenes de compra"
                          : "Escribe para buscar órdenes de compra"
                        }
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Orden seleccionada */}
              {selectedOrderId && (
                <div className="rounded-md bg-muted p-3">
                  <div className="text-sm font-medium text-muted-foreground">Orden seleccionada:</div>
                  <div className="text-base font-semibold">{selectedOrderId}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {editingOrder && (
            <>
              {/* 1. Información del Proveedor y Términos Comerciales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Información del Proveedor y Términos Comerciales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proveedor">Proveedor</Label>
                      <Select
                        value={editingOrder.proveedor || ""}
                        onValueChange={(value) => handleInputChange("proveedor", value)}
                      >
                        <SelectTrigger className={validationErrors.proveedor ? "border-red-500" : ""}>
                          <SelectValue placeholder="Seleccionar proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {proveedorOptions.map((proveedor) => (
                            <SelectItem key={proveedor} value={proveedor}>
                              {proveedor}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.proveedor && (
                        <p className="text-sm text-red-500">{validationErrors.proveedor}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incoterm">Incoterm</Label>
                      <Select
                        value={editingOrder.incoterm || ""}
                        onValueChange={(value) => handleInputChange("incoterm", value)}
                      >
                        <SelectTrigger className={validationErrors.incoterm ? "border-red-500" : ""}>
                          <SelectValue placeholder="Seleccionar incoterm" />
                        </SelectTrigger>
                        <SelectContent>
                          {incotermOptions.map((incoterm) => (
                            <SelectItem key={incoterm} value={incoterm}>
                              {incoterm}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.incoterm && (
                        <p className="text-sm text-red-500">{validationErrors.incoterm}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Logística y Transporte */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logística y Transporte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transportista">Transportista</Label>
                      <Select
                        value={editingOrder.transportista || ""}
                        onValueChange={(value) => handleInputChange("transportista", value)}
                      >
                        <SelectTrigger className={validationErrors.transportista ? "border-red-500" : ""}>
                          <SelectValue placeholder="Seleccionar transportista" />
                        </SelectTrigger>
                        <SelectContent>
                          {transportistaOptions.map((transportista) => (
                            <SelectItem key={transportista} value={transportista}>
                              {transportista}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.transportista && (
                        <p className="text-sm text-red-500">{validationErrors.transportista}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agente_aduanal">Agente Aduanal</Label>
                      <Input
                        id="agente_aduanal"
                        value={editingOrder.agente_aduanal || ""}
                        onChange={(e) => handleInputChange("agente_aduanal", e.target.value)}
                        placeholder="Nombre del agente aduanal"
                        className={validationErrors.agente_aduanal ? "border-red-500" : ""}
                      />
                      {validationErrors.agente_aduanal && (
                        <p className="text-sm text-red-500">{validationErrors.agente_aduanal}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Cronograma y Fechas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cronograma y Fechas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fecha_pedido">Fecha de Pedido</Label>
                      <Input
                        id="fecha_pedido"
                        type="date"
                        value={editingOrder.fecha_pedido || ""}
                        onChange={(e) => handleInputChange("fecha_pedido", e.target.value)}
                        className={validationErrors.fecha_pedido ? "border-red-500" : ""}
                      />
                      {validationErrors.fecha_pedido && (
                        <p className="text-sm text-red-500">{validationErrors.fecha_pedido}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale_origen">Sale de Origen</Label>
                      <Input
                        id="sale_origen"
                        type="date"
                        value={editingOrder.sale_origen || ""}
                        onChange={(e) => handleInputChange("sale_origen", e.target.value)}
                        className={validationErrors.sale_origen ? "border-red-500" : ""}
                      />
                      {validationErrors.sale_origen && (
                        <p className="text-sm text-red-500">{validationErrors.sale_origen}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pago_credito">Pago Crédito</Label>
                      <Input
                        id="pago_credito"
                        type="date"
                        value={editingOrder.pago_credito || ""}
                        onChange={(e) => handleInputChange("pago_credito", e.target.value)}
                        className={validationErrors.pago_credito ? "border-red-500" : ""}
                      />
                      {validationErrors.pago_credito && (
                        <p className="text-sm text-red-500">{validationErrors.pago_credito}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llega_a_Lazaro">Llega a Lázaro</Label>
                      <Input
                        id="llega_a_Lazaro"
                        type="date"
                        value={editingOrder.llega_a_Lazaro || ""}
                        onChange={(e) => handleInputChange("llega_a_Lazaro", e.target.value)}
                        className={validationErrors.llega_a_Lazaro ? "border-red-500" : ""}
                      />
                      {validationErrors.llega_a_Lazaro && (
                        <p className="text-sm text-red-500">{validationErrors.llega_a_Lazaro}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llega_a_Manzanillo">Llega a Manzanillo</Label>
                      <Input
                        id="llega_a_Manzanillo"
                        type="date"
                        value={editingOrder.llega_a_Manzanillo || ""}
                        onChange={(e) => handleInputChange("llega_a_Manzanillo", e.target.value)}
                        className={validationErrors.llega_a_Manzanillo ? "border-red-500" : ""}
                      />
                      {validationErrors.llega_a_Manzanillo && (
                        <p className="text-sm text-red-500">{validationErrors.llega_a_Manzanillo}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llega_almacen_proveedor">Llega Almacén Proveedor</Label>
                      <Input
                        id="llega_almacen_proveedor"
                        type="date"
                        value={editingOrder.llega_almacen_proveedor || ""}
                        onChange={(e) => handleInputChange("llega_almacen_proveedor", e.target.value)}
                        className={validationErrors.llega_almacen_proveedor ? "border-red-500" : ""}
                      />
                      {validationErrors.llega_almacen_proveedor && (
                        <p className="text-sm text-red-500">{validationErrors.llega_almacen_proveedor}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Documentación */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pedimento">Pedimento</Label>
                      <Input
                        id="pedimento"
                        value={editingOrder.pedimento || ""}
                        onChange={(e) => handleInputChange("pedimento", e.target.value)}
                        placeholder="Número de pedimento"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="factura_proveedor">Factura Proveedor</Label>
                      <Input
                        id="factura_proveedor"
                        value={editingOrder.factura_proveedor || ""}
                        onChange={(e) => handleInputChange("factura_proveedor", e.target.value)}
                        placeholder="Número de factura"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reporte_inspeccion">Reporte Inspección</Label>
                      <Input
                        id="reporte_inspeccion"
                        value={editingOrder.reporte_inspeccion || ""}
                        onChange={(e) => handleInputChange("reporte_inspeccion", e.target.value)}
                        placeholder="Reporte de inspección"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pedimento_transito">Pedimento Tránsito</Label>
                      <Input
                        id="pedimento_transito"
                        value={editingOrder.pedimento_tránsito || ""}
                        onChange={(e) => handleInputChange("pedimento_tránsito", e.target.value)}
                        placeholder="Pedimento de tránsito"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5. Información Financiera */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información Financiera</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="precio_m_fob_usd">FOB (USD)</Label>
                      <Input
                        id="precio_m_fob_usd"
                        type="number"
                        step="0.01"
                        value={editingOrder.precio_m_fob_usd || ""}
                        onChange={(e) => handleInputChange("precio_m_fob_usd", parseFloat(e.target.value) || 0)}
                        placeholder="Precio FOB en USD"
                        className={validationErrors.precio_m_fob_usd ? "border-red-500" : ""}
                      />
                      {validationErrors.precio_m_fob_usd && (
                        <p className="text-sm text-red-500">{validationErrors.precio_m_fob_usd}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo_de_cambio">Tipo de Cambio</Label>
                      <Input
                        id="tipo_de_cambio"
                        type="number"
                        step="0.0001"
                        value={editingOrder.tipo_de_cambio || ""}
                        onChange={(e) => handleInputChange("tipo_de_cambio", parseFloat(e.target.value) || 0)}
                        placeholder="Tipo de cambio"
                        className={validationErrors.tipo_de_cambio ? "border-red-500" : ""}
                      />
                      {validationErrors.tipo_de_cambio && (
                        <p className="text-sm text-red-500">{validationErrors.tipo_de_cambio}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="venta">Venta</Label>
                      <Input
                        id="venta"
                        type="number"
                        step="0.01"
                        value={editingOrder.venta || ""}
                        onChange={(e) => handleInputChange("venta", parseFloat(e.target.value) || 0)}
                        placeholder="Precio de venta"
                        className={validationErrors.venta ? "border-red-500" : ""}
                      />
                      {validationErrors.venta && (
                        <p className="text-sm text-red-500">{validationErrors.venta}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 6. Telas y Precios de Venta Individuales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Telas y Precios de Venta ({orderTelas.length} telas)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderTelas.map((tela, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-lg">
                          {tela["pedido_cliente.tipo_tela"] || "Sin especificar"} - {tela["pedido_cliente.color"] || "Sin color"}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {tela["pedido_cliente.total_m_pedidos"] || 0} {tela["pedido_cliente.unidad"] || "m"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tela-${index}-precio-venta`}>Precio de Venta</Label>
                          <Input
                            id={`tela-${index}-precio-venta`}
                            type="number"
                            step="0.01"
                            value={tela.venta || ""}
                            onChange={(e) => handleTelaChange(index, "venta", parseFloat(e.target.value) || 0)}
                            placeholder="Precio de venta"
                            className={telaValidationErrors[index]?.venta ? "border-red-500" : ""}
                          />
                          {telaValidationErrors[index]?.venta && (
                            <p className="text-sm text-red-500">{telaValidationErrors[index].venta}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Metros Factura</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={tela.m_factura || ""}
                            onChange={(e) => handleTelaChange(index, "m_factura", parseFloat(e.target.value) || 0)}
                            placeholder="Metros en factura"
                            className={telaValidationErrors[index]?.m_factura ? "border-red-500" : ""}
                          />
                          {telaValidationErrors[index]?.m_factura && (
                            <p className="text-sm text-red-500">{telaValidationErrors[index].m_factura}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Total Factura (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={tela.total_factura || ""}
                            onChange={(e) => handleTelaChange(index, "total_factura", parseFloat(e.target.value) || 0)}
                            placeholder="Total factura USD"
                            className={telaValidationErrors[index]?.total_factura ? "border-red-500" : ""}
                          />
                          {telaValidationErrors[index]?.total_factura && (
                            <p className="text-sm text-red-500">{telaValidationErrors[index].total_factura}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <strong>Total FOB:</strong> ${((tela.precio_m_fob_usd || 0) * (tela["pedido_cliente.total_m_pedidos"] || 0)).toLocaleString()}
                          </div>
                          <div>
                            <strong>Margen:</strong> {tela.venta && tela.precio_m_fob_usd 
                              ? ((((tela.venta - tela.precio_m_fob_usd) / tela.precio_m_fob_usd) * 100).toFixed(1)) + '%'
                              : 'N/A'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {orderTelas.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Selecciona una orden de compra para ver las telas asociadas
                    </div>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Botones de acción */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <SaveIcon className="h-4 w-4 mr-2" />
                  {isSaving ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};