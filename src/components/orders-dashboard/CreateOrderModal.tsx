import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveIcon, XIcon, Loader2, Plus, Trash2 } from "lucide-react";

// Zod schema for individual fabric
const fabricSchema = z.object({
  tipo_tela: z.string().min(1, "Tipo de tela es requerido"),
  color: z.string().min(1, "Color es requerido"),
  total_m_pedidos: z.number().min(0.01, "Metros pedidos debe ser mayor a 0"),
  unidad: z.enum(["KG", "MTS"], { required_error: "Unidad es requerida" }),
  precio_m_fob_usd: z.number().min(0.01, "Precio FOB debe ser mayor a 0"),
  venta: z.number().min(0.01, "Precio de venta debe ser mayor a 0"),
  m_factura: z.number().min(0.01, "Metros factura debe ser mayor a 0"),
});

// Zod schema for the entire form
const createOrderSchema = z.object({
  // Section 0: Order Identification
  orden_de_compra: z.string().min(1, "Orden de compra es requerida"),
  Year: z.number().min(2000, "Año inválido"),
  proveedor: z.string().min(1, "Proveedor es requerido"),

  // Section 1: Provider and Commercial Terms
  incoterm: z.string().min(1, "Incoterm es requerido"),

  // Section 2: Logistics
  transportista: z.string().min(1, "Transportista es requerido"),
  agente_aduanal: z.string().min(1, "Agente aduanal es requerido"),

  // Section 3: Dates
  fecha_pedido: z.string().optional(),
  sale_origen: z.string().optional(),
  pago_credito: z.string().optional(),
  llega_a_mexico: z.string().optional(),
  llega_almacen_proveedor: z.string().optional(),

  // Section 4: Documentation
  pedimento: z.string().optional(),
  factura_proveedor: z.string().optional(),
  reporte_inspeccion: z.string().optional(),
  pedimento_tránsito: z.string().optional(),

  // Section 5: Financial
  tipo_de_cambio: z.number().min(0.01, "Tipo de cambio debe ser mayor a 0"),
  total_gastos: z.number().optional(),

  // Section 6: Fabrics (minimum 1 required)
  fabrics: z.array(fabricSchema).min(1, "Debe agregar al menos una tela"),
});

type CreateOrderFormData = z.infer<typeof createOrderSchema>;

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  children: React.ReactNode;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  children,
}) => {
  const [isSaving, setIsSaving] = useState(false);

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

  // Auto-calculate total_factura for each fabric
  const calculateTotalFactura = (index: number) => {
    const fabric = watchedFabrics[index];
    if (fabric && fabric.precio_m_fob_usd && fabric.m_factura) {
      return (fabric.precio_m_fob_usd * fabric.m_factura).toFixed(2);
    }
    return "0.00";
  };

  // Auto-calculate margin percentage
  const calculateMargin = (index: number) => {
    const fabric = watchedFabrics[index];
    if (fabric && fabric.venta && fabric.precio_m_fob_usd && fabric.precio_m_fob_usd > 0) {
      const margin = ((fabric.venta - fabric.precio_m_fob_usd) / fabric.precio_m_fob_usd) * 100;
      return margin.toFixed(1) + "%";
    }
    return "N/A";
  };

  // Auto-calculate total FOB per color
  const calculateTotalFobPerColor = (index: number) => {
    const fabric = watchedFabrics[index];
    if (fabric && fabric.precio_m_fob_usd && fabric.total_m_pedidos) {
      return (fabric.precio_m_fob_usd * fabric.total_m_pedidos).toFixed(2);
    }
    return "0.00";
  };

  const handleAddFabric = () => {
    append({
      tipo_tela: "",
      color: "",
      total_m_pedidos: 0,
      unidad: "MTS",
      precio_m_fob_usd: 0,
      venta: 0,
      m_factura: 0,
    });
  };

  const handleRemoveFabric = (index: number) => {
    // Prevent removing the last fabric
    if (fields.length > 1) {
      remove(index);
    } else {
      toast.error("Debe haber al menos una tela");
    }
  };

  const onSubmit = async (data: CreateOrderFormData) => {
    setIsSaving(true);

    try {
      // Transform form data to API format
      const items = data.fabrics.map(fabric => ({
        // Order-level fields (shared across all items)
        orden_de_compra: data.orden_de_compra,
        Year: data.Year,
        proveedor: data.proveedor,
        incoterm: data.incoterm,
        transportista: data.transportista,
        agente_aduanal: data.agente_aduanal,
        fecha_pedido: data.fecha_pedido || null,
        sale_origen: data.sale_origen || null,
        pago_credito: data.pago_credito || null,
        llega_a_mexico: data.llega_a_mexico || null,
        llega_almacen_proveedor: data.llega_almacen_proveedor || null,
        pedimento: data.pedimento || null,
        factura_proveedor: data.factura_proveedor || null,
        reporte_inspeccion: data.reporte_inspeccion || null,
        pedimento_tránsito: data.pedimento_tránsito || null,
        tipo_de_cambio: data.tipo_de_cambio,
        total_gastos: data.total_gastos || 0,

        // Item-level fields (unique per fabric)
        "pedido_cliente.tipo_tela": fabric.tipo_tela,
        "pedido_cliente.color": fabric.color,
        "pedido_cliente.total_m_pedidos": fabric.total_m_pedidos,
        "pedido_cliente.unidad": fabric.unidad,
        precio_m_fob_usd: fabric.precio_m_fob_usd,
        venta: fabric.venta,
        m_factura: fabric.m_factura,

        // Calculated fields
        total_factura: fabric.precio_m_fob_usd * fabric.m_factura,
        total_x_color_fob_usd: fabric.precio_m_fob_usd * fabric.total_m_pedidos,
      }));

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
      console.log("✅ Orden creada:", result);

      toast.success("Orden creada exitosamente", {
        description: `Se creó la orden ${data.orden_de_compra} con ${data.fabrics.length} tela(s)`,
      });

      // Reset form and close modal
      reset();
      onClose();

      // Call success callback to refresh parent data
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("❌ Error creando orden:", error);
      toast.error("Error al crear la orden", {
        description: "Hubo un problema al crear la orden. Inténtalo de nuevo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Crear Nueva Orden de Compra
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                    Año <span className="text-red-500">*</span>
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
                    Proveedor <span className="text-red-500">*</span>
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
                  <Label htmlFor="incoterm">
                    Incoterm <span className="text-red-500">*</span>
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
                    Transportista <span className="text-red-500">*</span>
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
                    Agente Aduanal <span className="text-red-500">*</span>
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
                  <Input
                    id="fecha_pedido"
                    type="date"
                    {...register("fecha_pedido")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sale_origen">Sale de Origen</Label>
                  <Input
                    id="sale_origen"
                    type="date"
                    {...register("sale_origen")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pago_credito">Pago Crédito</Label>
                  <Input
                    id="pago_credito"
                    type="date"
                    {...register("pago_credito")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llega_a_mexico">Llega a México</Label>
                  <Input
                    id="llega_a_mexico"
                    type="date"
                    {...register("llega_a_mexico")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llega_almacen_proveedor">Llega Almacén Proveedor</Label>
                  <Input
                    id="llega_almacen_proveedor"
                    type="date"
                    {...register("llega_almacen_proveedor")}
                  />
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
                  <Input
                    id="pedimento"
                    {...register("pedimento")}
                    placeholder="Número de pedimento"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="factura_proveedor">Factura Proveedor</Label>
                  <Input
                    id="factura_proveedor"
                    {...register("factura_proveedor")}
                    placeholder="Número de factura"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reporte_inspeccion">Reporte Inspección</Label>
                  <Input
                    id="reporte_inspeccion"
                    {...register("reporte_inspeccion")}
                    placeholder="Reporte de inspección"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pedimento_tránsito">Pedimento Tránsito</Label>
                  <Input
                    id="pedimento_tránsito"
                    {...register("pedimento_tránsito")}
                    placeholder="Pedimento de tránsito"
                  />
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
                    Tipo de Cambio <span className="text-red-500">*</span>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddFabric}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Tela
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-4 pr-4">
                  {fields.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay telas agregadas. Haz clic en &quot;Agregar Tela&quot; para comenzar.
                    </div>
                  )}

                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4 bg-white">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-lg">
                          Tela {index + 1}
                        </h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFabric(index)}
                          disabled={fields.length === 1}
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
                            <p className="text-sm text-red-500">
                              {errors.fabrics[index]?.tipo_tela?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fabrics.${index}.color`}>
                            Color <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`fabrics.${index}.color`}
                            {...register(`fabrics.${index}.color`)}
                            placeholder="Marino"
                            className={errors.fabrics?.[index]?.color ? "border-red-500" : ""}
                          />
                          {errors.fabrics?.[index]?.color && (
                            <p className="text-sm text-red-500">
                              {errors.fabrics[index]?.color?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fabrics.${index}.total_m_pedidos`}>
                            Metros Pedidos <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`fabrics.${index}.total_m_pedidos`}
                            type="number"
                            step="0.01"
                            {...register(`fabrics.${index}.total_m_pedidos`, { valueAsNumber: true })}
                            placeholder="5000.0"
                            className={errors.fabrics?.[index]?.total_m_pedidos ? "border-red-500" : ""}
                          />
                          {errors.fabrics?.[index]?.total_m_pedidos && (
                            <p className="text-sm text-red-500">
                              {errors.fabrics[index]?.total_m_pedidos?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fabrics.${index}.unidad`}>
                            Unidad <span className="text-red-500">*</span>
                          </Label>
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
                            <p className="text-sm text-red-500">
                              {errors.fabrics[index]?.unidad?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fabrics.${index}.precio_m_fob_usd`}>
                            Precio FOB (USD) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`fabrics.${index}.precio_m_fob_usd`}
                            type="number"
                            step="0.01"
                            {...register(`fabrics.${index}.precio_m_fob_usd`, { valueAsNumber: true })}
                            placeholder="3.98"
                            className={errors.fabrics?.[index]?.precio_m_fob_usd ? "border-red-500" : ""}
                          />
                          {errors.fabrics?.[index]?.precio_m_fob_usd && (
                            <p className="text-sm text-red-500">
                              {errors.fabrics[index]?.precio_m_fob_usd?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fabrics.${index}.venta`}>
                            Precio de Venta <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`fabrics.${index}.venta`}
                            type="number"
                            step="0.01"
                            {...register(`fabrics.${index}.venta`, { valueAsNumber: true })}
                            placeholder="7.395"
                            className={errors.fabrics?.[index]?.venta ? "border-red-500" : ""}
                          />
                          {errors.fabrics?.[index]?.venta && (
                            <p className="text-sm text-red-500">
                              {errors.fabrics[index]?.venta?.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fabrics.${index}.m_factura`}>
                            Metros Factura <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`fabrics.${index}.m_factura`}
                            type="number"
                            step="0.01"
                            {...register(`fabrics.${index}.m_factura`, { valueAsNumber: true })}
                            placeholder="4830.7"
                            className={errors.fabrics?.[index]?.m_factura ? "border-red-500" : ""}
                          />
                          {errors.fabrics?.[index]?.m_factura && (
                            <p className="text-sm text-red-500">
                              {errors.fabrics[index]?.m_factura?.message}
                            </p>
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
              </ScrollArea>

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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
      </DialogContent>
    </Dialog>
  );
};
