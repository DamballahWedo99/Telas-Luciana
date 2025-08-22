import React, { useState, useEffect } from "react";
import { editOrderSchema, editTelaSchema } from "@/lib/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SaveIcon, XIcon, Loader2, Check } from "lucide-react";

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

interface EditOrderModalProps {
  data: PedidoData[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedOrders: PedidoData[]) => void;
  children: React.ReactNode;
  preselectedOrders?: PedidoData[];
  isPendingOrder?: boolean;
  onDataRefresh?: () => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  data,
  isOpen,
  onClose,
  onSave,
  children,
  preselectedOrders,
  isPendingOrder = false,
  onDataRefresh,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [editingOrder, setEditingOrder] = useState<PedidoData | null>(null);
  const [orderTelas, setOrderTelas] = useState<PedidoData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [telaValidationErrors, setTelaValidationErrors] = useState<Record<number, Record<string, string>>>({});
  const [allowTelaEditing, setAllowTelaEditing] = useState<boolean>(false);
  const [allowProveedorEditing, setAllowProveedorEditing] = useState<boolean>(false);
  const [allowLogisticaEditing, setAllowLogisticaEditing] = useState<boolean>(false);
  const [allowFechasEditing, setAllowFechasEditing] = useState<boolean>(false);
  const [allowDocumentacionEditing, setAllowDocumentacionEditing] = useState<boolean>(false);
  const [allowFinancieraEditing, setAllowFinancieraEditing] = useState<boolean>(false);
  const [isCompletingOrder, setIsCompletingOrder] = useState<boolean>(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState<boolean>(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState<boolean>(false);

  // Generar opciones de transportistas dinámicamente desde los datos


  // Obtener órdenes únicas
  const uniqueOrders = Array.from(
    new Set(data.map((item) => item.orden_de_compra))
  ).filter((value): value is string => typeof value === "string" && value !== "");

  // Filtrar órdenes basado en la búsqueda
  const filteredOrders = uniqueOrders.filter((order) =>
    order.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Efecto para manejar órdenes preseleccionadas
  useEffect(() => {
    if (preselectedOrders && preselectedOrders.length > 0 && isOpen) {
      setIsLoadingInitialData(true);
      // Simular carga de datos (en caso real, aquí podrías cargar datos adicionales)
      setTimeout(() => {
        setOrderTelas([...preselectedOrders]);
        setEditingOrder({ ...preselectedOrders[0] });
        setSelectedOrderId(preselectedOrders[0].orden_de_compra || "");
        setIsLoadingInitialData(false);
      }, 500); // Pequeño delay para mostrar el loader
    }
  }, [preselectedOrders, isOpen]);

  useEffect(() => {
    if (selectedOrderId && !preselectedOrders) {
      // Obtener todas las telas asociadas a esta orden de compra
      const relatedTelas = data.filter((item) => item.orden_de_compra === selectedOrderId);
      setOrderTelas(relatedTelas);
      
      // Seleccionar la primera como orden base para datos generales
      if (relatedTelas.length > 0) {
        setEditingOrder({ ...relatedTelas[0] });
      }
    } else if (!selectedOrderId && !preselectedOrders) {
      setEditingOrder(null);
      setOrderTelas([]);
    }
  }, [selectedOrderId, data, preselectedOrders]);


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
    'llega_a_mexico',
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
    'tipo_de_cambio',
    'total_gastos'
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

  const handleSaveData = async () => {
    if (!editingOrder || orderTelas.length === 0) return;

    setValidationErrors({});
    setTelaValidationErrors({});

    // Validar cada sección habilitada por separado
    const errors: Record<string, string> = {};
    
    if (allowProveedorEditing) {
      const proveedorValidation = editOrderSchema.pick({
        proveedor: true,
        incoterm: true,
      }).safeParse({
        proveedor: editingOrder.proveedor || "",
        incoterm: editingOrder.incoterm || "",
      });
      
      if (!proveedorValidation.success) {
        proveedorValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }
    
    if (allowLogisticaEditing) {
      const logisticaValidation = editOrderSchema.pick({
        transportista: true,
        agente_aduanal: true,
      }).safeParse({
        transportista: editingOrder.transportista || "",
        agente_aduanal: editingOrder.agente_aduanal || "",
      });
      
      if (!logisticaValidation.success) {
        logisticaValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }
    
    if (allowFechasEditing) {
      const fechasValidation = editOrderSchema.pick({
        fecha_pedido: true,
        sale_origen: true,
        pago_credito: true,
        llega_a_mexico: true,
        llega_almacen_proveedor: true,
      }).safeParse({
        fecha_pedido: editingOrder.fecha_pedido || "",
        sale_origen: editingOrder.sale_origen || "",
        pago_credito: editingOrder.pago_credito || "",
        llega_a_mexico: editingOrder.llega_a_mexico || "",
        llega_almacen_proveedor: editingOrder.llega_almacen_proveedor || "",
      });
      
      if (!fechasValidation.success) {
        fechasValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }
    
    if (allowDocumentacionEditing) {
      const documentacionValidation = editOrderSchema.pick({
        pedimento: true,
        factura_proveedor: true,
        reporte_inspeccion: true,
        pedimento_tránsito: true,
      }).safeParse({
        pedimento: editingOrder.pedimento || "",
        factura_proveedor: editingOrder.factura_proveedor || "",
        reporte_inspeccion: editingOrder.reporte_inspeccion || "",
        pedimento_tránsito: editingOrder.pedimento_tránsito || "",
      });
      
      if (!documentacionValidation.success) {
        documentacionValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }
    
    if (allowFinancieraEditing) {
      const financieraValidation = editOrderSchema.pick({
        tipo_de_cambio: true,
        total_gastos: true,
      }).safeParse({
        tipo_de_cambio: editingOrder.tipo_de_cambio || 0,
        total_gastos: editingOrder.total_gastos || 0,
      });
      
      if (!financieraValidation.success) {
        financieraValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }
    
    // Si hay errores de validación, mostrarlos y salir
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Validar las telas individuales solo si la edición está habilitada
    const telaErrors: Record<number, Record<string, string>> = {};
    let hasTelaErrors = false;

    if (allowTelaEditing) {
      orderTelas.forEach((tela, index) => {
        const telaData = {
          precio_m_fob_usd: tela.precio_m_fob_usd || 0,
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
    }

    setIsSaving(true);
    try {
      // Aplicar cambios generales a todas las telas de la orden y limpiar campos calculados
      const updatedTelas = orderTelas.map(tela => {
        const updatedTela = { ...tela };
        
        // Solo aplicar cambios de las secciones habilitadas
        if (allowProveedorEditing) {
          updatedTela.proveedor = editingOrder.proveedor;
          updatedTela.incoterm = editingOrder.incoterm;
        }
        
        if (allowLogisticaEditing) {
          updatedTela.transportista = editingOrder.transportista;
          updatedTela.agente_aduanal = editingOrder.agente_aduanal;
        }
        
        if (allowFechasEditing) {
          updatedTela.fecha_pedido = editingOrder.fecha_pedido;
          updatedTela.sale_origen = editingOrder.sale_origen;
          updatedTela.pago_credito = editingOrder.pago_credito;
          updatedTela.llega_a_mexico = editingOrder.llega_a_mexico;
          updatedTela.llega_almacen_proveedor = editingOrder.llega_almacen_proveedor;
        }
        
        if (allowDocumentacionEditing) {
          updatedTela.pedimento = editingOrder.pedimento;
          updatedTela.factura_proveedor = editingOrder.factura_proveedor;
          updatedTela.reporte_inspeccion = editingOrder.reporte_inspeccion;
          updatedTela.pedimento_tránsito = editingOrder.pedimento_tránsito;
        }
        
        if (allowFinancieraEditing) {
          updatedTela.tipo_de_cambio = editingOrder.tipo_de_cambio;
          updatedTela.total_gastos = editingOrder.total_gastos;
        }

        // Calcular total_factura automáticamente si hay precio FOB y metros factura
        if (allowTelaEditing && updatedTela.precio_m_fob_usd && updatedTela.m_factura) {
          updatedTela.total_factura = Number(updatedTela.precio_m_fob_usd) * Number(updatedTela.m_factura);
        }

        // Si la edición de telas no está permitida, mantener los valores originales de FOB, venta, m_factura y total_factura
        if (!allowTelaEditing) {
          const originalTela = data.find(originalItem => 
            originalItem.orden_de_compra === tela.orden_de_compra &&
            originalItem["pedido_cliente.tipo_tela"] === tela["pedido_cliente.tipo_tela"] &&
            originalItem["pedido_cliente.color"] === tela["pedido_cliente.color"]
          );
          
          if (originalTela) {
            updatedTela.precio_m_fob_usd = originalTela.precio_m_fob_usd;
            updatedTela.venta = originalTela.venta;
            updatedTela.m_factura = originalTela.m_factura;
            updatedTela.total_factura = originalTela.total_factura;
          }
        }
        
        // Limpiar campos calculados y reordenar antes de enviar
        return cleanAndReorderData(updatedTela);
      });

      if (isPendingOrder) {
        // Para órdenes pendientes, llamar API específica que no cambia status
        try {
          const response = await fetch('/api/orders/save-pending-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orders: updatedTelas,
              orden_de_compra: editingOrder.orden_de_compra,
            }),
          });

          if (!response.ok) {
            throw new Error('Error guardando datos');
          }

          const result = await response.json();
          console.log('✅ Datos guardados sin cambiar status:', result);
          toast.success("Datos guardados exitosamente", {
            description: "Los datos se guardaron sin cambiar el status de la orden"
          });
          
          // Llamar onDataRefresh para actualizar datos sin completar orden
          if (onDataRefresh) {
            onDataRefresh();
          }
        } catch (error) {
          console.error('❌ Error guardando datos:', error);
          toast.error("Error al guardar datos", {
            description: "Hubo un problema al guardar los datos. Inténtalo de nuevo."
          });
          throw error;
        }
      } else {
        // Para órdenes normales, usar el flujo original
        onSave(updatedTelas);
      }
      
      // Limpiar estado del modal
      setSelectedOrderId("");
      setEditingOrder(null);
      setOrderTelas([]);
      setSearchQuery("");
      setValidationErrors({});
      setTelaValidationErrors({});
      setAllowTelaEditing(false);
      setAllowProveedorEditing(false);
      setAllowLogisticaEditing(false);
      setAllowFechasEditing(false);
      setAllowDocumentacionEditing(false);
      setAllowFinancieraEditing(false);
      
      // Cerrar el modal
      onClose();
    } catch (error) {
      console.error("Error saving order:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!editingOrder || orderTelas.length === 0) return;

    setValidationErrors({});
    setTelaValidationErrors({});

    // Validar cada sección habilitada por separado
    const errors: Record<string, string> = {};
    
    if (allowProveedorEditing) {
      const proveedorValidation = editOrderSchema.pick({
        proveedor: true,
        incoterm: true,
      }).safeParse({
        proveedor: editingOrder.proveedor || "",
        incoterm: editingOrder.incoterm || "",
      });
      
      if (!proveedorValidation.success) {
        proveedorValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }
    
    if (allowLogisticaEditing) {
      const logisticaValidation = editOrderSchema.pick({
        transportista: true,
        agente_aduanal: true,
      }).safeParse({
        transportista: editingOrder.transportista || "",
        agente_aduanal: editingOrder.agente_aduanal || "",
      });
      
      if (!logisticaValidation.success) {
        logisticaValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }
    
    if (allowDocumentacionEditing) {
      const documentacionValidation = editOrderSchema.pick({
        factura_proveedor: true,
        pedimento: true,
        reporte_inspeccion: true,
        "pedimento_tránsito": true,
      }).safeParse({
        factura_proveedor: editingOrder.factura_proveedor || "",
        pedimento: editingOrder.pedimento || "",
        reporte_inspeccion: editingOrder.reporte_inspeccion || "",
        "pedimento_tránsito": editingOrder["pedimento_tránsito"] || "",
      });
      
      if (!documentacionValidation.success) {
        documentacionValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }

    if (allowFechasEditing) {
      const fechasValidation = editOrderSchema.pick({
        fecha_pedido: true,
        sale_origen: true,
        llega_a_Lazaro: true,
        llega_a_Manzanillo: true,
        llega_a_mexico: true,
        llega_almacen_proveedor: true,
      }).safeParse({
        fecha_pedido: editingOrder.fecha_pedido || "",
        sale_origen: editingOrder.sale_origen || "",
        llega_a_Lazaro: editingOrder.llega_a_Lazaro || "",
        llega_a_Manzanillo: editingOrder.llega_a_Manzanillo || "",
        llega_a_mexico: editingOrder.llega_a_mexico || "",
        llega_almacen_proveedor: editingOrder.llega_almacen_proveedor || "",
      });
      
      if (!fechasValidation.success) {
        fechasValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }

    if (allowFinancieraEditing) {
      const financieraValidation = editOrderSchema.pick({
        m_factura: true,
        total_factura: true,
        tipo_de_cambio: true,
        total_gastos: true,
        venta: true,
      }).safeParse({
        m_factura: Number(editingOrder.m_factura) || 0,
        total_factura: Number(editingOrder.total_factura) || 0,
        tipo_de_cambio: Number(editingOrder.tipo_de_cambio) || 0,
        total_gastos: Number(editingOrder.total_gastos) || 0,
        venta: Number(editingOrder.venta) || 0,
      });
      
      if (!financieraValidation.success) {
        financieraValidation.error.errors.forEach((error) => {
          if (error.path.length > 0) {
            errors[error.path[0].toString()] = error.message;
          }
        });
      }
    }

    // Validar telas individuales
    const telasErrors: Record<number, Record<string, string>> = {};
    
    if (allowTelaEditing) {
      orderTelas.forEach((tela, index) => {
        const validationData: Record<string, unknown> = {};
        
        // Solo incluir campos que tienen valores válidos
        if (tela.precio_m_fob_usd && Number(tela.precio_m_fob_usd) > 0) {
          validationData.precio_m_fob_usd = Number(tela.precio_m_fob_usd);
        }
        if (tela.venta && Number(tela.venta) > 0) {
          validationData.venta = Number(tela.venta);
        }
        if (tela.m_factura && Number(tela.m_factura) > 0) {
          validationData.m_factura = Number(tela.m_factura);
        }
        
        console.log(`🔍 Validando tela ${index}:`, validationData);
        console.log(`🔍 Valores originales tela ${index}:`, {
          precio_m_fob_usd: tela.precio_m_fob_usd,
          venta: tela.venta,
          m_factura: tela.m_factura
        });

        const telaValidation = editTelaSchema.safeParse(validationData);

        if (!telaValidation.success) {
          console.log(`❌ Error validación tela ${index}:`, telaValidation.error.errors);
          const indexErrors: Record<string, string> = {};
          telaValidation.error.errors.forEach((error) => {
            if (error.path.length > 0) {
              indexErrors[error.path[0].toString()] = error.message;
            }
          });
          if (Object.keys(indexErrors).length > 0) {
            telasErrors[index] = indexErrors;
          }
        }
      });
    }

    // Si hay errores, mostrarlos y no continuar
    if (Object.keys(errors).length > 0 || Object.keys(telasErrors).length > 0) {
      setValidationErrors(errors);
      setTelaValidationErrors(telasErrors);
      console.log("Errores de validación:", { errors, telasErrors });
      return;
    }

    setIsCompletingOrder(true);

    try {
      // Preparar datos actualizados manteniendo el orden original
      const updatedTelas = orderTelas.map((tela) => {
        const originalTela = data.find(
          (original) =>
            original["pedido_cliente.tipo_tela"] === tela["pedido_cliente.tipo_tela"] &&
            original["pedido_cliente.color"] === tela["pedido_cliente.color"]
        );

        const updatedTela = { ...originalTela, ...editingOrder };

        // Solo actualizar campos de tela si se permite edición de telas
        if (allowTelaEditing) {
          updatedTela["pedido_cliente.tipo_tela"] = tela["pedido_cliente.tipo_tela"];
          updatedTela["pedido_cliente.color"] = tela["pedido_cliente.color"];
          updatedTela["pedido_cliente.total_m_pedidos"] = tela["pedido_cliente.total_m_pedidos"];
          updatedTela.precio_m_fob_usd = tela.precio_m_fob_usd;
          updatedTela.venta = tela.venta;
          updatedTela.m_factura = tela.m_factura;
          updatedTela.total_x_color_fob_usd = tela.total_x_color_fob_usd;
          updatedTela.fraccion = tela.fraccion;
          
          // Calcular total_factura automáticamente: precio_fob * metros_factura
          if (tela.precio_m_fob_usd && tela.m_factura) {
            updatedTela.total_factura = Number(tela.precio_m_fob_usd) * Number(tela.m_factura);
          }
        }

        // Preservar campos calculados si existen
        if (originalTela) {
          if (originalTela.m_factura && !allowFinancieraEditing) {
            updatedTela.m_factura = originalTela.m_factura;
          }
          if (originalTela.total_factura && !allowFinancieraEditing) {
            updatedTela.total_factura = originalTela.total_factura;
          }
        }
        
        // Limpiar campos calculados y reordenar antes de enviar
        return cleanAndReorderData(updatedTela);
      });

      // Llamar API para completar orden (cambia status a completed)
      try {
        const response = await fetch('/api/orders/save-pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orders: updatedTelas,
            orden_de_compra: editingOrder.orden_de_compra,
          }),
        });

        if (!response.ok) {
          throw new Error('Error completando orden');
        }

        const result = await response.json();
        console.log('✅ Orden completada:', result);
        toast.success("Orden completada exitosamente", {
          description: "La orden se marcó como completada y los datos se guardaron"
        });
        
        // Actualizar datos desde backend después de completar orden
        if (onDataRefresh) {
          console.log('🔄 Actualizando datos del dashboard después de completar orden...');
          await onDataRefresh();
          console.log('✅ Datos del dashboard actualizados exitosamente');
        }
      } catch (error) {
        console.error('❌ Error completando orden:', error);
        toast.error("Error al completar orden", {
          description: "Hubo un problema al completar la orden. Inténtalo de nuevo."
        });
        throw error;
      }
      
      // Guardar todas las telas actualizadas de una vez (no async para UX fluida)
      onSave(updatedTelas);
      
      // Limpiar estado del modal
      setSelectedOrderId("");
      setEditingOrder(null);
      setOrderTelas([]);
      setSearchQuery("");
      setValidationErrors({});
      setTelaValidationErrors({});
      setAllowTelaEditing(false);
      setAllowProveedorEditing(false);
      setAllowLogisticaEditing(false);
      setAllowFechasEditing(false);
      setAllowDocumentacionEditing(false);
      setAllowFinancieraEditing(false);
      setShowCompletionConfirm(false);
      
      // Cerrar el modal
      onClose();
    } catch (error) {
      console.error("Error completing order:", error);
    } finally {
      setIsCompletingOrder(false);
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
    setAllowTelaEditing(false);
    setAllowProveedorEditing(false);
    setAllowLogisticaEditing(false);
    setAllowFechasEditing(false);
    setAllowDocumentacionEditing(false);
    setAllowFinancieraEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Orden de Compra
          </DialogTitle>
        </DialogHeader>

        <div className={`space-y-6 ${showCompletionConfirm ? 'hidden' : ''}`}>
          {/* Selector de Orden de Compra - Solo mostrar si no hay órdenes preseleccionadas */}
          {!preselectedOrders && (
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
          )}

          {/* Mostrar información de orden preseleccionada */}
          {preselectedOrders && selectedOrderId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Editando Orden de Compra</CardTitle>  
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-sm font-medium text-muted-foreground">Orden:</div>
                  <div className="text-base font-semibold">{selectedOrderId}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {orderTelas.length} tela{orderTelas.length > 1 ? 's' : ''} en esta orden
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoadingInitialData ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="p-4 bg-blue-50 rounded-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <p className="text-gray-600 font-medium">
                Cargando datos de la orden...
              </p>
            </div>
          ) : editingOrder && (
            <>
              {/* 1. Información del Proveedor y Términos Comerciales */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Información del Proveedor y Términos Comerciales
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="proveedor-editing-checkbox" className="text-sm font-medium">
                        Permitir edición
                      </Label>
                      <Checkbox
                        id="proveedor-editing-checkbox"
                        checked={allowProveedorEditing}
                        onCheckedChange={(checked) => setAllowProveedorEditing(checked === true)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={`space-y-4 ${!allowProveedorEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proveedor">Proveedor</Label>
                      <Input
                        id="proveedor"
                        value={editingOrder.proveedor || ""}
                        onChange={(e) => handleInputChange("proveedor", e.target.value)}
                        placeholder="Nombre del proveedor"
                        disabled={!allowProveedorEditing}
                        className={validationErrors.proveedor ? "border-red-500" : ""}
                      />
                      {validationErrors.proveedor && (
                        <p className="text-sm text-red-500">{validationErrors.proveedor}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incoterm">Incoterm</Label>
                      <Input
                        id="incoterm"
                        value={editingOrder.incoterm || ""}
                        onChange={(e) => handleInputChange("incoterm", e.target.value)}
                        placeholder="Términos de entrega (ej: CIF MEXICAN PORT)"
                        disabled={!allowProveedorEditing}
                        className={validationErrors.incoterm ? "border-red-500" : ""}
                      />
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Logística y Transporte</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="logistica-editing-checkbox" className="text-sm font-medium">
                        Permitir edición
                      </Label>
                      <Checkbox
                        id="logistica-editing-checkbox"
                        checked={allowLogisticaEditing}
                        onCheckedChange={(checked) => setAllowLogisticaEditing(checked === true)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={`space-y-4 ${!allowLogisticaEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transportista">Transportista</Label>
                      <Input
                        id="transportista"
                        type="text"
                        value={editingOrder.transportista || ""}
                        onChange={(e) => handleInputChange("transportista", e.target.value)}
                        placeholder="Transportista"
                        disabled={!allowLogisticaEditing}
                        className={validationErrors.transportista ? "border-red-500" : ""}
                      />
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
                        disabled={!allowLogisticaEditing}
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Cronograma y Fechas</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="fechas-editing-checkbox" className="text-sm font-medium">
                        Permitir edición
                      </Label>
                      <Checkbox
                        id="fechas-editing-checkbox"
                        checked={allowFechasEditing}
                        onCheckedChange={(checked) => setAllowFechasEditing(checked === true)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={`space-y-4 ${!allowFechasEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fecha_pedido">Fecha de Pedido</Label>
                      <Input
                        id="fecha_pedido"
                        type="date"
                        value={editingOrder.fecha_pedido || ""}
                        onChange={(e) => handleInputChange("fecha_pedido", e.target.value)}
                        disabled={!allowFechasEditing}
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
                        disabled={!allowFechasEditing}
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
                        disabled={!allowFechasEditing}
                        className={validationErrors.pago_credito ? "border-red-500" : ""}
                      />
                      {validationErrors.pago_credito && (
                        <p className="text-sm text-red-500">{validationErrors.pago_credito}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llega_a_mexico">Llega a México</Label>
                      <Input
                        id="llega_a_mexico"
                        type="date"
                        value={editingOrder.llega_a_mexico || ""}
                        onChange={(e) => handleInputChange("llega_a_mexico", e.target.value)}
                        disabled={!allowFechasEditing}
                        className={validationErrors.llega_a_mexico ? "border-red-500" : ""}
                      />
                      {validationErrors.llega_a_mexico && (
                        <p className="text-sm text-red-500">{validationErrors.llega_a_mexico}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llega_almacen_proveedor">Llega Almacén Proveedor</Label>
                      <Input
                        id="llega_almacen_proveedor"
                        type="date"
                        value={editingOrder.llega_almacen_proveedor || ""}
                        onChange={(e) => handleInputChange("llega_almacen_proveedor", e.target.value)}
                        disabled={!allowFechasEditing}
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Documentación</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="documentacion-editing-checkbox" className="text-sm font-medium">
                        Permitir edición
                      </Label>
                      <Checkbox
                        id="documentacion-editing-checkbox"
                        checked={allowDocumentacionEditing}
                        onCheckedChange={(checked) => setAllowDocumentacionEditing(checked === true)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={`space-y-4 ${!allowDocumentacionEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pedimento">Pedimento</Label>
                      <Input
                        id="pedimento"
                        value={editingOrder.pedimento || ""}
                        onChange={(e) => handleInputChange("pedimento", e.target.value)}
                        placeholder="Número de pedimento"
                        disabled={!allowDocumentacionEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="factura_proveedor">Factura Proveedor</Label>
                      <Input
                        id="factura_proveedor"
                        value={editingOrder.factura_proveedor || ""}
                        onChange={(e) => handleInputChange("factura_proveedor", e.target.value)}
                        placeholder="Número de factura"
                        disabled={!allowDocumentacionEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reporte_inspeccion">Reporte Inspección</Label>
                      <Input
                        id="reporte_inspeccion"
                        value={editingOrder.reporte_inspeccion || ""}
                        onChange={(e) => handleInputChange("reporte_inspeccion", e.target.value)}
                        placeholder="Reporte de inspección"
                        disabled={!allowDocumentacionEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pedimento_transito">Pedimento Tránsito</Label>
                      <Input
                        id="pedimento_transito"
                        value={editingOrder.pedimento_tránsito || ""}
                        onChange={(e) => handleInputChange("pedimento_tránsito", e.target.value)}
                        placeholder="Pedimento de tránsito"
                        disabled={!allowDocumentacionEditing}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5. Información Financiera */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Información Financiera y Gastos</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="financiera-editing-checkbox" className="text-sm font-medium">
                        Permitir edición
                      </Label>
                      <Checkbox
                        id="financiera-editing-checkbox"
                        checked={allowFinancieraEditing}
                        onCheckedChange={(checked) => setAllowFinancieraEditing(checked === true)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={`space-y-4 ${!allowFinancieraEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_de_cambio">Tipo de Cambio</Label>
                      <Input
                        id="tipo_de_cambio"
                        type="number"
                        step="0.0001"
                        value={editingOrder.tipo_de_cambio || ""}
                        onChange={(e) => handleInputChange("tipo_de_cambio", parseFloat(e.target.value) || 0)}
                        placeholder="Tipo de cambio"
                        disabled={!allowFinancieraEditing}
                        className={validationErrors.tipo_de_cambio ? "border-red-500" : ""}
                      />
                      {validationErrors.tipo_de_cambio && (
                        <p className="text-sm text-red-500">{validationErrors.tipo_de_cambio}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_gastos">Total Gastos (MXN)</Label>
                      <Input
                        id="total_gastos"
                        type="number"
                        step="0.01"
                        value={editingOrder.total_gastos || ""}
                        onChange={(e) => handleInputChange("total_gastos", parseFloat(e.target.value) || 0)}
                        placeholder="Total de gastos en MXN"
                        disabled={!allowFinancieraEditing}
                        className={validationErrors.total_gastos ? "border-red-500" : ""}
                      />
                      {validationErrors.total_gastos && (
                        <p className="text-sm text-red-500">{validationErrors.total_gastos}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 6. Telas y Precios de Venta Individuales */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Telas y Precios de Venta ({orderTelas.length} telas)
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="tela-editing-checkbox" className="text-sm font-medium">
                        Permitir edición
                      </Label>
                      <Checkbox
                        id="tela-editing-checkbox"
                        checked={allowTelaEditing}
                        onCheckedChange={(checked) => setAllowTelaEditing(checked === true)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={`space-y-4 ${!allowTelaEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                  {orderTelas.map((tela, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-lg">
                          {tela["pedido_cliente.tipo_tela"] || "Sin especificar"} - {tela["pedido_cliente.color"] || "Sin color"}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {tela["pedido_cliente.total_m_pedidos"] || 0} m pedidos
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tela-${index}-precio-fob`}>Precio FOB (USD)</Label>
                          <Input
                            id={`tela-${index}-precio-fob`}
                            type="number"
                            step="0.01"
                            value={tela.precio_m_fob_usd || ""}
                            onChange={(e) => handleTelaChange(index, "precio_m_fob_usd", parseFloat(e.target.value) || 0)}
                            placeholder="Precio FOB en USD"
                            disabled={!allowTelaEditing}
                            className={telaValidationErrors[index]?.precio_m_fob_usd ? "border-red-500" : ""}
                          />
                          {telaValidationErrors[index]?.precio_m_fob_usd && (
                            <p className="text-sm text-red-500">{telaValidationErrors[index].precio_m_fob_usd}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`tela-${index}-precio-venta`}>Precio de Venta</Label>
                          <Input
                            id={`tela-${index}-precio-venta`}
                            type="number"
                            step="0.01"
                            value={tela.venta || ""}
                            onChange={(e) => handleTelaChange(index, "venta", parseFloat(e.target.value) || 0)}
                            placeholder="Precio de venta"
                            disabled={!allowTelaEditing}
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
                            disabled={!allowTelaEditing}
                            className={telaValidationErrors[index]?.m_factura ? "border-red-500" : ""}
                          />
                          {telaValidationErrors[index]?.m_factura && (
                            <p className="text-sm text-red-500">{telaValidationErrors[index].m_factura}</p>
                          )}
                        </div>
                        
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <strong>Total Factura (USD):</strong> ${((tela.precio_m_fob_usd || 0) * (tela.m_factura || 0)).toLocaleString('es-MX')}
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
                
                {isPendingOrder ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleSaveData} 
                      disabled={isSaving || isCompletingOrder}
                    >
                      <SaveIcon className="h-4 w-4 mr-2" />
                      {isSaving ? "Guardando..." : "Guardar Datos"}
                    </Button>
                    
                    <Button 
                      onClick={() => setShowCompletionConfirm(true)} 
                      disabled={isSaving || isCompletingOrder}
                      className="bg-black hover:bg-gray-800 text-white"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Completar Orden
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleSaveData} disabled={isSaving}>
                    <SaveIcon className="h-4 w-4 mr-2" />
                    {isSaving ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                )}
              </div>
              
            </>
          )}
        </div>
        
        {/* Modal de confirmación para completar orden */}
        {showCompletionConfirm && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="p-4 bg-amber-50 rounded-full">
              <Check className="h-8 w-8 text-amber-600" />
            </div>
            <div className="text-center space-y-4 max-w-md">
              <h3 className="text-lg font-semibold text-gray-900">Confirmar Completar Orden</h3>
              <p className="text-gray-600">
                ¿Estás seguro de que quieres marcar esta orden como completada? 
                Esta acción cambiará el status de la orden y no se podrá deshacer.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowCompletionConfirm(false)}
                disabled={isCompletingOrder}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCompleteOrder} 
                disabled={isCompletingOrder}
                className="bg-black hover:bg-gray-800 text-white"
              >
                {isCompletingOrder ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Completando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Sí, Completar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};