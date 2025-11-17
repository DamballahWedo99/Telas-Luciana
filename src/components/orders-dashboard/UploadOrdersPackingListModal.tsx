import React, { useState, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2Icon,
  UploadIcon,
  FolderOpenIcon,
  CheckCircle,
  SaveIcon,
  XIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface UploadResult {
  uploadId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileUrl: string;
}

interface UploadOrdersPackingListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Zod schema for individual fabric
// Only tipo_tela is required, all other fields are optional
// NaN values from empty number inputs are transformed to undefined
const fabricSchema = z.object({
  tipo_tela: z.string().min(1, "Tipo de tela es requerido"),
  color: z.string().optional(),
  total_m_pedidos: z.number().or(z.nan()).transform(val => isNaN(val) ? undefined : val).optional(),
  unidad: z.enum(["KG", "MTS"]).optional(),
  precio_m_fob_usd: z.number().or(z.nan()).transform(val => isNaN(val) ? undefined : val).optional(),
  venta: z.number().or(z.nan()).transform(val => isNaN(val) ? undefined : val).optional(),
  m_factura: z.number().or(z.nan()).transform(val => isNaN(val) ? undefined : val).optional(),
});

// Zod schema for the entire manual form
const createOrderSchema = z.object({
  // Section 0: Order Identification - ONLY REQUIRED FIELD
  orden_de_compra: z.string().min(1, "Orden de compra es requerida"),
  Year: z.number().optional(),
  proveedor: z.string().optional(),

  // Section 1: Provider and Commercial Terms - All optional
  contacto: z.string().optional(),
  origen: z.string().optional(),
  incoterm: z.string().optional(),

  // Section 2: Logistics - All optional
  transportista: z.string().optional(),
  agente_aduanal: z.string().optional(),

  // Section 3: Dates - All optional
  fecha_pedido: z.string().optional(),
  sale_origen: z.string().optional(),
  pago_credito: z.string().optional(),
  llega_a_México: z.string().optional(),
  llega_almacen_proveedor: z.string().optional(),

  // Section 4: Documentation - All optional
  pedimento: z.string().optional(),
  factura_proveedor: z.string().optional(),
  reporte_inspeccion: z.string().optional(),
  pedimento_tránsito: z.string().optional(),

  // Section 5: Financial - All optional
  tipo_de_cambio: z.number().optional(),
  total_gastos: z.number().optional(),

  // Section 6: Fabrics - Optional, can be empty array
  fabrics: z.array(fabricSchema).optional(),
});

type CreateOrderFormData = z.infer<typeof createOrderSchema>;

export const UploadOrdersPackingListModal: React.FC<UploadOrdersPackingListModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for manual entry
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    control,
    reset,
  } = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      Year: new Date().getFullYear(),
      tipo_de_cambio: 0,
      total_gastos: 0,
      fabrics: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "fabrics",
  });

  // Watch fabric fields for auto-calculations
  const watchedFabrics = watch("fabrics");

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Auto-calculation functions for manual entry
  const calculateTotalFactura = (index: number) => {
    if (!watchedFabrics) return "N/A";
    const fabric = watchedFabrics[index];
    if (fabric && fabric.precio_m_fob_usd !== undefined && fabric.m_factura !== undefined) {
      return (fabric.precio_m_fob_usd * fabric.m_factura).toFixed(2);
    }
    return "N/A";
  };

  const calculateMargin = (index: number) => {
    if (!watchedFabrics) return "N/A";
    const fabric = watchedFabrics[index];
    if (fabric && fabric.venta !== undefined && fabric.precio_m_fob_usd !== undefined && fabric.precio_m_fob_usd > 0) {
      const margin = ((fabric.venta - fabric.precio_m_fob_usd) / fabric.precio_m_fob_usd) * 100;
      return margin.toFixed(1) + "%";
    }
    return "N/A";
  };

  const calculateTotalFobPerColor = (index: number) => {
    if (!watchedFabrics) return "N/A";
    const fabric = watchedFabrics[index];
    if (fabric && fabric.precio_m_fob_usd !== undefined && fabric.total_m_pedidos !== undefined) {
      return (fabric.precio_m_fob_usd * fabric.total_m_pedidos).toFixed(2);
    }
    return "N/A";
  };

  const handleAddFabric = () => {
    append({
      tipo_tela: "",
      color: undefined,
      total_m_pedidos: undefined,
      unidad: undefined,
      precio_m_fob_usd: undefined,
      venta: undefined,
      m_factura: undefined,
    });
  };

  const handleRemoveFabric = (index: number) => {
    remove(index);
  };

  const handleClose = () => {
    setUploadResult(null);
    reset();
    onClose();
  };

  // Manual entry submit handler
  const onSubmitManual = async (data: CreateOrderFormData) => {
    setIsSaving(true);

    try {
      // Transform form data to API format
      // If no fabrics, create a single item with just the order info
      const items = (data.fabrics && data.fabrics.length > 0)
        ? data.fabrics.map(fabric => ({
            // Order-level fields (shared across all items)
            orden_de_compra: data.orden_de_compra,
            Year: data.Year || new Date().getFullYear(),
            proveedor: data.proveedor || "",
            contacto: data.contacto || "",
            origen: data.origen || "",
            incoterm: data.incoterm || "",
            transportista: data.transportista || "",
            agente_aduanal: data.agente_aduanal || "",
            fecha_pedido: data.fecha_pedido || null,
            sale_origen: data.sale_origen || null,
            pago_credito: data.pago_credito || null,
            llega_a_México: data.llega_a_México || null,
            llega_almacen_proveedor: data.llega_almacen_proveedor || null,
            pedimento: data.pedimento || null,
            factura_proveedor: data.factura_proveedor || null,
            reporte_inspeccion: data.reporte_inspeccion || null,
            pedimento_tránsito: data.pedimento_tránsito || null,
            tipo_de_cambio: data.tipo_de_cambio?.toString() || "0",
            total_gastos: data.total_gastos?.toString() || "0",

            // Item-level fields (unique per fabric) - handle undefined values
            "pedido_cliente.tipo_tela": fabric.tipo_tela,
            "pedido_cliente.color": fabric.color || "",
            "pedido_cliente.total_m_pedidos": fabric.total_m_pedidos ?? 0,
            "pedido_cliente.unidad": fabric.unidad || "",
            precio_m_fob_usd: fabric.precio_m_fob_usd ?? 0,
            venta: (fabric.venta ?? 0).toString(),
            m_factura: fabric.m_factura ?? 0,

            // Calculated fields - handle undefined values
            total_factura: (fabric.precio_m_fob_usd ?? 0) * (fabric.m_factura ?? 0),
            total_x_color_fob_usd: (fabric.precio_m_fob_usd ?? 0) * (fabric.total_m_pedidos ?? 0),
          }))
        : [{
            // Order-level fields only (no fabric data)
            orden_de_compra: data.orden_de_compra,
            Year: data.Year || new Date().getFullYear(),
            proveedor: data.proveedor || "",
            contacto: data.contacto || "",
            origen: data.origen || "",
            incoterm: data.incoterm || "",
            transportista: data.transportista || "",
            agente_aduanal: data.agente_aduanal || "",
            fecha_pedido: data.fecha_pedido || null,
            sale_origen: data.sale_origen || null,
            pago_credito: data.pago_credito || null,
            llega_a_México: data.llega_a_México || null,
            llega_almacen_proveedor: data.llega_almacen_proveedor || null,
            pedimento: data.pedimento || null,
            factura_proveedor: data.factura_proveedor || null,
            reporte_inspeccion: data.reporte_inspeccion || null,
            pedimento_tránsito: data.pedimento_tránsito || null,
            tipo_de_cambio: data.tipo_de_cambio?.toString() || "0",
            total_gastos: data.total_gastos?.toString() || "0",

            // Item-level fields (empty/default values)
            "pedido_cliente.tipo_tela": "",
            "pedido_cliente.color": "",
            "pedido_cliente.total_m_pedidos": 0,
            "pedido_cliente.unidad": "",
            precio_m_fob_usd: 0,
            venta: "0",
            m_factura: 0,

            // Calculated fields
            total_factura: 0,
            total_x_color_fob_usd: 0,
          }];

      const response = await fetch("/api/orders/create-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orden_de_compra: data.orden_de_compra,
          items,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear la orden");
      }

      const result = await response.json();

      toast.success("Orden creada exitosamente", {
        description: `Se creó la orden ${data.orden_de_compra} con ${data.fabrics?.length || 0} tela(s)`,
      });

      // Dispatch event for data refresh
      const event = new CustomEvent("orders-uploaded", {
        detail: {
          fileName: `${data.orden_de_compra}-manual.json`,
          uploadedAt: new Date().toISOString(),
          result: result,
        },
      });

      window.dispatchEvent(event);

      // Iniciar polling después de 3 segundos
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("start-orders-polling"));
      }, 3000);

      // Reset form and close modal
      reset();
      onClose();
    } catch {
      toast.error("Error al crear la orden", {
        description: "Hubo un problema al crear la orden. Inténtalo de nuevo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Por favor, selecciona un archivo de Excel (.xlsx o .xls)");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("El archivo es demasiado grande. Tamaño máximo: 10MB");
      return;
    }

    handlePackingListUpload(file);
  };

  const handlePackingListUpload = async (file: File) => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/orders/upload-orders", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al subir la Orden de Compra");
      }

      const result = await response.json();
      setUploadResult(result);

      toast.success("Archivo subido correctamente al bucket S3");

      const event = new CustomEvent("orders-uploaded", {
        detail: {
          fileName: file.name,
          uploadId: result.uploadId,
          uploadedAt: new Date().toISOString(),
          result: result,
        },
      });

      window.dispatchEvent(event);

      // Iniciar polling después de 3 segundos
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("start-orders-polling"));
      }, 3000);
    } catch (error) {
      toast.error(
        typeof error === "object" && error !== null && "message" in error
          ? (error as Error).message
          : "Error al subir el archivo de Orden de Compra"
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">+</span>
            Subir Orden de Compra
          </DialogTitle>
          <DialogDescription>
            Sube un archivo de orden de compra o créala manualmente.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Subir Archivo</TabsTrigger>
            <TabsTrigger value="manual">Entrada Manual</TabsTrigger>
          </TabsList>

          {/* Tab 1: File Upload */}
          <TabsContent value="upload" className="space-y-4">
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <FolderOpenIcon className="h-12 w-12 text-gray-400 mb-4" />
              <p className="mb-4 text-sm text-gray-500 text-center">
                Selecciona un archivo Excel con la información de la Orden de Compra
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".xlsx,.xls"
              />
              <Button
                onClick={handleUploadClick}
                disabled={isUploading}
                className="flex items-center mb-4"
              >
                {isUploading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Seleccionar Archivo
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-400">
                Formatos soportados: .xlsx, .xls (máximo 10MB)
              </p>
            </div>

            {uploadResult && (
              <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="text-sm font-medium text-green-800">
                    Archivo cargado exitosamente
                  </h3>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p>
                    <strong>Archivo:</strong> {uploadResult.originalName}
                  </p>
                  <p>
                    <strong>Tamaño:</strong>{" "}
                    {formatFileSize(uploadResult.fileSize)}
                  </p>
                  <p>
                    <strong>ID de carga:</strong> {uploadResult.uploadId}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                {uploadResult ? "Cerrar" : "Cancelar"}
              </Button>
            </div>
          </TabsContent>

          {/* Tab 2: Manual Entry */}
          <TabsContent value="manual">
            <form onSubmit={handleSubmit(onSubmitManual)} className="space-y-6">
              {/* Section 0: Order Identification */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Identificación de la Orden</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orden_de_compra">
                        Orden de Compra <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="orden_de_compra"
                        {...register("orden_de_compra")}
                        placeholder="DR-01-25-DEPOR-POL1-01-01-25"
                        className={errors.orden_de_compra ? "border-red-500" : ""}
                      />
                      {errors.orden_de_compra && (
                        <p className="text-sm text-red-500">{errors.orden_de_compra.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="Year">
                        Año
                      </Label>
                      <Input
                        id="Year"
                        type="number"
                        {...register("Year", { valueAsNumber: true })}
                        placeholder="2025"
                        className={errors.Year ? "border-red-500" : ""}
                      />
                      {errors.Year && (
                        <p className="text-sm text-red-500">{errors.Year.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proveedor">
                        Proveedor
                      </Label>
                      <Input
                        id="proveedor"
                        {...register("proveedor")}
                        placeholder="Nombre del proveedor"
                        className={errors.proveedor ? "border-red-500" : ""}
                      />
                      {errors.proveedor && (
                        <p className="text-sm text-red-500">{errors.proveedor.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 1: Provider and Commercial Terms */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Información del Proveedor y Términos Comerciales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proveedor-readonly">Proveedor</Label>
                      <Input
                        id="proveedor-readonly"
                        value={watch("proveedor") || ""}
                        disabled
                        className="bg-gray-50"
                      />
                      <p className="text-xs text-gray-500">Auto-completado desde Sección 0</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contacto">
                        Contacto
                      </Label>
                      <Input
                        id="contacto"
                        {...register("contacto")}
                        placeholder="Andy Gao"
                        className={errors.contacto ? "border-red-500" : ""}
                      />
                      {errors.contacto && (
                        <p className="text-sm text-red-500">{errors.contacto.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="origen">
                        Origen
                      </Label>
                      <Input
                        id="origen"
                        {...register("origen")}
                        placeholder="China"
                        className={errors.origen ? "border-red-500" : ""}
                      />
                      {errors.origen && (
                        <p className="text-sm text-red-500">{errors.origen.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="incoterm">
                        Incoterm
                      </Label>
                      <Input
                        id="incoterm"
                        {...register("incoterm")}
                        placeholder="FOB SHANGHAI"
                        className={errors.incoterm ? "border-red-500" : ""}
                      />
                      {errors.incoterm && (
                        <p className="text-sm text-red-500">{errors.incoterm.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Logistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logística y Transporte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transportista">
                        Transportista
                      </Label>
                      <Input
                        id="transportista"
                        {...register("transportista")}
                        placeholder="Nombre del transportista"
                        className={errors.transportista ? "border-red-500" : ""}
                      />
                      {errors.transportista && (
                        <p className="text-sm text-red-500">{errors.transportista.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agente_aduanal">
                        Agente Aduanal
                      </Label>
                      <Input
                        id="agente_aduanal"
                        {...register("agente_aduanal")}
                        placeholder="Nombre del agente aduanal"
                        className={errors.agente_aduanal ? "border-red-500" : ""}
                      />
                      {errors.agente_aduanal && (
                        <p className="text-sm text-red-500">{errors.agente_aduanal.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Dates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cronograma y Fechas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fecha_pedido">Fecha de Pedido</Label>
                      <Input id="fecha_pedido" type="date" {...register("fecha_pedido")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale_origen">Sale de Origen</Label>
                      <Input id="sale_origen" type="date" {...register("sale_origen")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pago_credito">Pago Crédito</Label>
                      <Input id="pago_credito" type="date" {...register("pago_credito")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llega_a_México">Llega a México</Label>
                      <Input id="llega_a_México" type="date" {...register("llega_a_México")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llega_almacen_proveedor">Llega Almacén Proveedor</Label>
                      <Input id="llega_almacen_proveedor" type="date" {...register("llega_almacen_proveedor")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: Documentation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pedimento">Pedimento</Label>
                      <Input id="pedimento" {...register("pedimento")} placeholder="Número de pedimento" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="factura_proveedor">Factura Proveedor</Label>
                      <Input id="factura_proveedor" {...register("factura_proveedor")} placeholder="Número de factura" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reporte_inspeccion">Reporte Inspección</Label>
                      <Input id="reporte_inspeccion" {...register("reporte_inspeccion")} placeholder="Reporte de inspección" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pedimento_tránsito">Pedimento Tránsito</Label>
                      <Input id="pedimento_tránsito" {...register("pedimento_tránsito")} placeholder="Pedimento de tránsito" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: Financial */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información Financiera y Gastos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_de_cambio">
                        Tipo de Cambio
                      </Label>
                      <Input
                        id="tipo_de_cambio"
                        type="number"
                        step="0.0001"
                        {...register("tipo_de_cambio", { valueAsNumber: true })}
                        placeholder="19.8867"
                        className={errors.tipo_de_cambio ? "border-red-500" : ""}
                      />
                      {errors.tipo_de_cambio && (
                        <p className="text-sm text-red-500">{errors.tipo_de_cambio.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_gastos">Total Gastos (MXN)</Label>
                      <Input
                        id="total_gastos"
                        type="number"
                        step="0.01"
                        {...register("total_gastos", { valueAsNumber: true })}
                        placeholder="640297.52"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 6: Fabrics */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Telas y Precios de Venta ({fields.length} tela{fields.length !== 1 ? "s" : ""})
                    </CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddFabric} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Agregar Tela
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {fields.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No hay telas agregadas. Haz clic en &quot;Agregar Tela&quot; para comenzar.
                      </div>
                    )}

                    {fields.map((field, index) => (
                        <div key={field.id} className="border rounded-lg p-4 space-y-4 bg-white">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-lg">Tela {index + 1}</h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFabric(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`fabrics.${index}.tipo_tela`}>
                                Tipo de Tela <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`fabrics.${index}.tipo_tela`}
                                {...register(`fabrics.${index}.tipo_tela`)}
                                placeholder="POLINEO Regulares"
                                className={errors.fabrics?.[index]?.tipo_tela ? "border-red-500" : ""}
                              />
                              {errors.fabrics?.[index]?.tipo_tela && (
                                <p className="text-sm text-red-500">{errors.fabrics[index]?.tipo_tela?.message}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`fabrics.${index}.color`}>Color</Label>
                              <Input
                                id={`fabrics.${index}.color`}
                                {...register(`fabrics.${index}.color`)}
                                placeholder="Marino"
                                className={errors.fabrics?.[index]?.color ? "border-red-500" : ""}
                              />
                              {errors.fabrics?.[index]?.color && (
                                <p className="text-sm text-red-500">{errors.fabrics[index]?.color?.message}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`fabrics.${index}.total_m_pedidos`}>Metros Pedidos</Label>
                              <Input
                                id={`fabrics.${index}.total_m_pedidos`}
                                type="number"
                                step="0.01"
                                {...register(`fabrics.${index}.total_m_pedidos`, { valueAsNumber: true })}
                                placeholder="5000.0"
                                className={errors.fabrics?.[index]?.total_m_pedidos ? "border-red-500" : ""}
                              />
                              {errors.fabrics?.[index]?.total_m_pedidos && (
                                <p className="text-sm text-red-500">{errors.fabrics[index]?.total_m_pedidos?.message}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`fabrics.${index}.unidad`}>Unidad</Label>
                              <Select
                                value={watch(`fabrics.${index}.unidad`)}
                                onValueChange={(value) => setValue(`fabrics.${index}.unidad`, value as "KG" | "MTS")}
                              >
                                <SelectTrigger className={errors.fabrics?.[index]?.unidad ? "border-red-500" : ""}>
                                  <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MTS">MTS</SelectItem>
                                  <SelectItem value="KG">KG</SelectItem>
                                </SelectContent>
                              </Select>
                              {errors.fabrics?.[index]?.unidad && (
                                <p className="text-sm text-red-500">{errors.fabrics[index]?.unidad?.message}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`fabrics.${index}.precio_m_fob_usd`}>Precio FOB (USD)</Label>
                              <Input
                                id={`fabrics.${index}.precio_m_fob_usd`}
                                type="number"
                                step="0.01"
                                {...register(`fabrics.${index}.precio_m_fob_usd`, { valueAsNumber: true })}
                                placeholder="3.98"
                                className={errors.fabrics?.[index]?.precio_m_fob_usd ? "border-red-500" : ""}
                              />
                              {errors.fabrics?.[index]?.precio_m_fob_usd && (
                                <p className="text-sm text-red-500">{errors.fabrics[index]?.precio_m_fob_usd?.message}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`fabrics.${index}.venta`}>Precio de Venta</Label>
                              <Input
                                id={`fabrics.${index}.venta`}
                                type="number"
                                step="0.01"
                                {...register(`fabrics.${index}.venta`, { valueAsNumber: true })}
                                placeholder="7.395"
                                className={errors.fabrics?.[index]?.venta ? "border-red-500" : ""}
                              />
                              {errors.fabrics?.[index]?.venta && (
                                <p className="text-sm text-red-500">{errors.fabrics[index]?.venta?.message}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`fabrics.${index}.m_factura`}>Metros Factura</Label>
                              <Input
                                id={`fabrics.${index}.m_factura`}
                                type="number"
                                step="0.01"
                                {...register(`fabrics.${index}.m_factura`, { valueAsNumber: true })}
                                placeholder="4830.7"
                                className={errors.fabrics?.[index]?.m_factura ? "border-red-500" : ""}
                              />
                              {errors.fabrics?.[index]?.m_factura && (
                                <p className="text-sm text-red-500">{errors.fabrics[index]?.m_factura?.message}</p>
                              )}
                            </div>
                          </div>

                          {/* Auto-calculated fields display */}
                          <div className="bg-gray-50 p-3 rounded text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <strong>Total Factura (USD):</strong> ${calculateTotalFactura(index)}
                              </div>
                              <div>
                                <strong>Margen:</strong> {calculateMargin(index)}
                              </div>
                              <div>
                                <strong>Total FOB por Color (USD):</strong> ${calculateTotalFobPerColor(index)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {errors.fabrics && typeof errors.fabrics.message === "string" && (
                    <p className="text-sm text-red-500">{errors.fabrics.message}</p>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleClose}>
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <SaveIcon className="h-4 w-4 mr-2" />
                      Crear Orden
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};