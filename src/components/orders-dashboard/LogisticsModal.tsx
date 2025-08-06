import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  TruckIcon,
  CalendarIcon,
  ContainerIcon,
  UserIcon,
  NotebookPenIcon,
  Search,
  EyeIcon,
  EditIcon,
  TrashIcon,
  ArrowLeft,
} from "lucide-react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const mobileQuery = window.matchMedia("(max-width: 768px)");
      setIsMobile(mobileQuery.matches);
    };

    if (typeof window !== "undefined") {
      checkIsMobile();
      window.addEventListener("resize", checkIsMobile);
      return () => window.removeEventListener("resize", checkIsMobile);
    }
  }, []);

  return isMobile;
}
import { logisticsSchema } from "@/lib/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TelaLogistic {
  tipo_tela: string;
}

interface LogisticsData {
  orden_de_compra: string;
  tela: TelaLogistic[];
  contenedor: string;
  etd: string; // Estimated Time of Departure
  eta: string; // Estimated Time of Arrival
  importador: string;
  notas: string;
  fecha_registro?: string; // Cuando se registró la información
  fecha_actualizacion?: string; // Cuando se actualizó por última vez
}

interface LogisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export const LogisticsModal: React.FC<LogisticsModalProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isLoadingLogistics, setIsLoadingLogistics] = useState(false);
  const [logisticsOrders, setLogisticsOrders] = useState<LogisticsData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewDetails, setViewDetails] = useState<LogisticsData | null>(null);
  const [editingOrder, setEditingOrder] = useState<LogisticsData | null>(null);
  const [originalOrderName, setOriginalOrderName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<LogisticsData | null>(null);
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState<LogisticsData>({
    orden_de_compra: "",
    tela: [],
    contenedor: "",
    etd: "",
    eta: "",
    importador: "",
    notas: "",
  });

  // Cargar órdenes de logística existentes
  const loadLogisticsOrders = async () => {
    setIsLoadingLogistics(true);
    try {
      const response = await fetch("/api/s3/logistica");
      if (response.ok) {
        const result = await response.json();
        setLogisticsOrders(result.data || []);
      } else {
        console.warn("No se pudieron cargar las órdenes de logística");
        setLogisticsOrders([]);
      }
    } catch (error) {
      console.error("Error cargando órdenes de logística:", error);
      setLogisticsOrders([]);
    } finally {
      setIsLoadingLogistics(false);
    }
  };

  // Cargar órdenes cuando se abre el modal
  useEffect(() => {
    if (isOpen && !showForm) {
      loadLogisticsOrders();
    }
  }, [isOpen, showForm]);

  // Filtrar órdenes por búsqueda
  const filteredLogisticsOrders = React.useMemo(() => {
    if (!searchQuery.trim()) return logisticsOrders;

    return logisticsOrders.filter(
      (order) =>
        order.orden_de_compra
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        order.contenedor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.importador?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.tela?.some((tela) =>
          tela.tipo_tela.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );
  }, [logisticsOrders, searchQuery]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowForm(false);
      setSearchQuery("");
      setLogisticsOrders([]);
      setViewDetails(null);
      setEditingOrder(null);
      setOriginalOrderName("");
      setFormErrors({});
      setDeleteConfirmation(null);
      setFormData({
        orden_de_compra: "",
        tela: [],
        contenedor: "",
        etd: "",
        eta: "",
        importador: "",
        notas: "",
      });
    }
  }, [isOpen]);

  const handleInputChange = (field: keyof LogisticsData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleShowForm = () => {
    setShowForm(true);
  };

  const handleBackToList = () => {
    setShowForm(false);
    setViewDetails(null);
    setEditingOrder(null);
    setOriginalOrderName("");
    setFormErrors({});
    setDeleteConfirmation(null);
    setFormData({
      orden_de_compra: "",
      tela: [],
      contenedor: "",
      etd: "",
      eta: "",
      importador: "",
      notas: "",
    });
  };

  const handleViewDetails = (order: LogisticsData) => {
    setViewDetails(order);
  };

  const handleEditOrder = (order: LogisticsData) => {
    setEditingOrder(order);
    setOriginalOrderName(order.orden_de_compra);
    setFormData({
      ...order,
      // Asegurar que las fechas estén en formato correcto para inputs de tipo date
      etd: order.etd || "",
      eta: order.eta || "",
    });
    setShowForm(true);
  };

  const handleDeleteOrder = (order: LogisticsData) => {
    setDeleteConfirmation(order);
  };

  const confirmDeleteOrder = async () => {
    if (!deleteConfirmation) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/s3/logistica?orden_de_compra=${encodeURIComponent(deleteConfirmation.orden_de_compra)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Error al eliminar la información logística"
        );
      }

      toast.success("Información logística eliminada exitosamente", {
        duration: 3000,
      });

      await loadLogisticsOrders();
      setDeleteConfirmation(null);
    } catch (error) {
      console.error("❌ Error eliminando información logística:", error);

      toast.error("Error al eliminar la información logística", {
        description:
          error instanceof Error ? error.message : "Error desconocido",
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteOrder = () => {
    setDeleteConfirmation(null);
  };

  const handleSubmit = async () => {
    // Validar con Zod
    const validation = logisticsSchema.safeParse(formData);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        const path = error.path.join(".");
        errors[path] = error.message;
      });
      setFormErrors(errors);

      // Mostrar primer error
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setFormErrors({});

    setIsSubmitting(true);
    const isEditing = !!editingOrder;

    try {
      const requestBody =
        isEditing && originalOrderName !== formData.orden_de_compra
          ? { ...formData, original_orden_de_compra: originalOrderName }
          : formData;

      const response = await fetch("/api/s3/logistica", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Error al ${isEditing ? "actualizar" : "guardar"} la información logística`
        );
      }

      const result = await response.json();

      toast.success(
        `Información logística ${isEditing ? "actualizada" : "guardada"} exitosamente`,
        {
          description: `Datos ${isEditing ? "actualizados" : "guardados"} para la orden ${formData.orden_de_compra}`,
          duration: 3000,
        }
      );

      // Regresar a la lista y actualizar
      setShowForm(false);
      setEditingOrder(null);
      setOriginalOrderName("");
      setFormData({
        orden_de_compra: "",
        tela: [],
        contenedor: "",
        etd: "",
        eta: "",
        importador: "",
        notas: "",
      });
      await loadLogisticsOrders(); // Recargar la lista
      console.log(
        `✅ Información logística ${isEditing ? "actualizada" : "guardada"}:`,
        result
      );
    } catch (error) {
      console.error(
        `❌ Error ${isEditing ? "actualizando" : "guardando"} información logística:`,
        error
      );

      toast.error(
        `Error al ${isEditing ? "actualizar" : "guardar"} la información logística`,
        {
          description:
            error instanceof Error ? error.message : "Error desconocido",
          duration: 5000,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isMobile) {
    return (
      <TooltipProvider>
        {children}
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-[95vw] h-[85vh] overflow-hidden p-0 rounded-3xl [&>button]:hidden">
            {viewDetails ? (
              // Vista Mobile de Detalles
              <>
                <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewDetails(null)}
                      className="h-8 w-8 p-0 rounded-lg"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="p-2.5 bg-blue-100 rounded-2xl">
                      <TruckIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-lg font-semibold">
                        {viewDetails.orden_de_compra}
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600">
                        Información detallada de la orden
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-base mb-3">
                        Información General
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            Orden de Compra
                          </span>
                          <p className="mt-1 text-sm bg-white p-2 rounded border font-mono">
                            {viewDetails.orden_de_compra}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            Contenedor
                          </span>
                          <p className="mt-1 text-sm bg-white p-2 rounded border">
                            {viewDetails.contenedor || "No especificado"}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            Importador
                          </span>
                          <p className="mt-1 text-sm bg-white p-2 rounded border">
                            {viewDetails.importador || "No especificado"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-base mb-3">
                        Fechas de Envío
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            ETD (Fecha de Salida)
                          </span>
                          <p className="mt-1 text-sm bg-white p-2 rounded border">
                            {viewDetails.etd
                              ? new Date(viewDetails.etd).toLocaleDateString(
                                  "es-ES"
                                )
                              : "No especificado"}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            ETA (Fecha de Llegada)
                          </span>
                          <p className="mt-1 text-sm bg-white p-2 rounded border">
                            {viewDetails.eta
                              ? new Date(viewDetails.eta).toLocaleDateString(
                                  "es-ES"
                                )
                              : "No especificado"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {viewDetails.tela && viewDetails.tela.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-base mb-3">
                          Telas ({viewDetails.tela.length})
                        </h3>
                        <div className="space-y-2">
                          {viewDetails.tela.map((tela, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 p-2 bg-white rounded border"
                            >
                              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 text-xs rounded-full flex items-center justify-center font-medium">
                                {index + 1}
                              </span>
                              <span className="text-sm">{tela.tipo_tela}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {viewDetails.notas && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-base mb-3">Notas</h3>
                        <p className="text-sm bg-white p-3 rounded border whitespace-pre-wrap">
                          {viewDetails.notas}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t bg-gray-50/80 backdrop-blur-sm rounded-b-3xl">
                  <Button
                    onClick={() => setViewDetails(null)}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    Regresar
                  </Button>
                </div>
              </>
            ) : !showForm ? (
              // Vista Mobile de Lista
              <>
                <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 rounded-2xl">
                      <TruckIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-lg font-semibold">
                        Logística
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600">
                        Órdenes de logística registradas
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-[400px]">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por orden, contenedor..."
                        className="pl-10 w-full h-12 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {isLoadingLogistics ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-4 bg-blue-50 rounded-full">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      </div>
                      <p className="text-gray-600 font-medium">
                        Cargando información logística...
                      </p>
                    </div>
                  ) : filteredLogisticsOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-6 bg-gray-50 rounded-full">
                        <TruckIcon className="h-12 w-12 text-gray-400" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="font-semibold text-gray-900">
                          No hay órdenes
                        </h3>
                        <p className="text-sm text-gray-500">
                          {searchQuery.trim()
                            ? "No se encontraron órdenes que coincidan"
                            : "No hay órdenes de logística disponibles"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto px-1">
                      {filteredLogisticsOrders.map((logisticsOrder) => (
                        <div
                          key={logisticsOrder.orden_de_compra}
                          className="bg-white border shadow-sm rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-mono text-base font-semibold">
                                {logisticsOrder.orden_de_compra}
                              </h3>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleViewDetails(logisticsOrder)
                                }
                                className="h-8 w-8 p-0 hover:bg-gray-50 hover:border-gray-300"
                              >
                                <EyeIcon className="h-4 w-4 text-gray-600" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditOrder(logisticsOrder)}
                                className="h-8 w-8 p-0 hover:bg-gray-50 hover:border-gray-300"
                              >
                                <EditIcon className="h-4 w-4 text-gray-600" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDeleteOrder(logisticsOrder)
                                }
                                disabled={isDeleting}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300"
                              >
                                <TrashIcon className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t bg-gray-50/80 backdrop-blur-sm rounded-b-3xl">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="flex-1 h-11 font-medium rounded-xl border-gray-300"
                    >
                      Cerrar
                    </Button>
                    <Button
                      onClick={handleShowForm}
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm"
                    ></Button>
                  </div>
                </div>
              </>
            ) : (
              // Vista Mobile de Formulario
              <>
                <div className="p-5 border-b bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-3xl">
                  <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBackToList}
                      className="mr-2 h-8 w-8 p-0 rounded-lg"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    {editingOrder ? "Editar Información" : "Nueva OC"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 mt-1 ml-12">
                    {editingOrder
                      ? "Actualizar datos logísticos"
                      : "Complete los datos logísticos"}
                  </DialogDescription>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  {/* Orden de Compra */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Orden de Compra *
                    </label>
                    <input
                      type="text"
                      value={formData.orden_de_compra}
                      onChange={(e) =>
                        handleInputChange("orden_de_compra", e.target.value)
                      }
                      placeholder="Ingrese la orden de compra"
                      className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.orden_de_compra ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.orden_de_compra && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.orden_de_compra}
                      </p>
                    )}
                  </div>

                  {/* Contenedor */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <ContainerIcon className="h-4 w-4" />
                      Contenedor
                    </label>
                    <input
                      type="text"
                      value={formData.contenedor}
                      onChange={(e) =>
                        handleInputChange("contenedor", e.target.value)
                      }
                      placeholder="Ej: TCLU1234567"
                      className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.contenedor ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.contenedor && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.contenedor}
                      </p>
                    )}
                  </div>

                  {/* ETD */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      ETD (Estimated Time of Departure)
                    </label>
                    <input
                      type="date"
                      value={formData.etd}
                      onChange={(e) => handleInputChange("etd", e.target.value)}
                      max="9999-12-31"
                      min="1000-01-01"
                      className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.etd ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.etd && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.etd}
                      </p>
                    )}
                  </div>

                  {/* ETA */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      ETA (Estimated Time of Arrival)
                    </label>
                    <input
                      type="date"
                      value={formData.eta}
                      onChange={(e) => handleInputChange("eta", e.target.value)}
                      max="9999-12-31"
                      min="1000-01-01"
                      className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.eta ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.eta && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.eta}
                      </p>
                    )}
                  </div>

                  {/* Importador */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      Importador
                    </label>
                    <input
                      type="text"
                      value={formData.importador}
                      onChange={(e) =>
                        handleInputChange("importador", e.target.value)
                      }
                      placeholder="Nombre del importador"
                      className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.importador ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.importador && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.importador}
                      </p>
                    )}
                  </div>

                  {/* Telas */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">
                        Telas
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            tela: [...prev.tela, { tipo_tela: "" }],
                          }));
                        }}
                        className="h-8 px-3 text-xs"
                      >
                        Agregar Tela
                      </Button>
                    </div>

                    {formData.tela.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                        <p className="text-gray-500 text-sm">
                          No hay telas registradas
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {formData.tela.map((tela, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">
                                Tela {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    tela: prev.tela.filter(
                                      (_, i) => i !== index
                                    ),
                                  }));
                                }}
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                ×
                              </Button>
                            </div>
                            <input
                              type="text"
                              value={tela.tipo_tela}
                              onChange={(e) => {
                                const newTelas = [...formData.tela];
                                newTelas[index] = { tipo_tela: e.target.value };
                                setFormData((prev) => ({
                                  ...prev,
                                  tela: newTelas,
                                }));
                              }}
                              placeholder="Ej: MICRO VELBOA"
                              className={`w-full h-10 px-3 border rounded focus:outline-none transition-colors ${formErrors[`tela.${index}.tipo_tela`] ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            />
                            {formErrors[`tela.${index}.tipo_tela`] && (
                              <p className="text-red-500 text-xs mt-1">
                                {formErrors[`tela.${index}.tipo_tela`]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <NotebookPenIcon className="h-4 w-4" />
                      Notas
                    </label>
                    <textarea
                      value={formData.notas}
                      onChange={(e) =>
                        handleInputChange("notas", e.target.value)
                      }
                      placeholder="Notas adicionales sobre la logística..."
                      rows={3}
                      className={`mt-1.5 w-full px-3 py-2 border rounded-lg focus:outline-none transition-colors resize-none ${formErrors.notas ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.notas && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.notas}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-5 border-t bg-gray-50/80 backdrop-blur-sm rounded-b-3xl">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleBackToList}
                      disabled={isSubmitting}
                      className="flex-1 h-11 border-gray-300 rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={
                        isSubmitting || !formData.orden_de_compra.trim()
                      }
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 shadow-sm rounded-xl"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingOrder ? "Actualizando..." : "Guardando..."}
                        </>
                      ) : (
                        <>{editingOrder ? "Actualizar" : "Guardar"}</>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de confirmación para eliminar - Mobile */}
        <Dialog
          open={!!deleteConfirmation}
          onOpenChange={() => setDeleteConfirmation(null)}
        >
          <DialogContent className="max-w-[90vw] rounded-3xl">
            <DialogHeader className="text-center">
              <DialogTitle className="flex items-center justify-center gap-2 text-lg text-red-600">
                <TrashIcon className="h-5 w-5" />
                Confirmar Eliminación
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Esta acción no se puede deshacer. Se eliminará permanentemente
                toda la información logística.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">
                  <strong>Orden de compra:</strong>{" "}
                  <span className="font-mono">
                    {deleteConfirmation?.orden_de_compra}
                  </span>
                </p>
                {deleteConfirmation?.contenedor && (
                  <p className="text-sm text-red-800 mt-1">
                    <strong>Contenedor:</strong> {deleteConfirmation.contenedor}
                  </p>
                )}
              </div>

              <p className="text-sm text-gray-600 text-center">
                ¿Está seguro de que desea eliminar esta información logística?
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={cancelDeleteOrder}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl border-gray-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteOrder}
                disabled={isDeleting}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 rounded-xl"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <TrashIcon className="mr-2 h-4 w-4" />
                    Eliminar
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      {children}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewDetails
                ? `Detalles - ${viewDetails.orden_de_compra}`
                : showForm
                  ? editingOrder
                    ? "Editar Información"
                    : "Nueva OC"
                  : "Información Logística"}
            </DialogTitle>
            <DialogDescription>
              {viewDetails
                ? "Información detallada de la orden logística"
                : showForm
                  ? "Complete los datos logísticos para la orden de compra"
                  : `Órdenes de logística registradas (${filteredLogisticsOrders.length} de ${logisticsOrders.length} total)`}
            </DialogDescription>
          </DialogHeader>

          {viewDetails ? (
            // Vista de Detalles de Orden Logística
            <div className="space-y-6 py-4">
              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">
                    Información General
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Orden de Compra
                      </Label>
                      <p className="mt-1 text-sm bg-gray-50 p-2 rounded font-mono">
                        {viewDetails.orden_de_compra}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Contenedor
                      </Label>
                      <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
                        {viewDetails.contenedor || "No especificado"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Importador
                      </Label>
                      <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
                        {viewDetails.importador || "No especificado"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Fecha de Registro
                      </Label>
                      <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
                        {viewDetails.fecha_registro
                          ? new Date(
                              viewDetails.fecha_registro
                            ).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "No disponible"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">
                    Fechas de Envío
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        ETD (Fecha de Salida)
                      </Label>
                      <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
                        {viewDetails.etd
                          ? new Date(viewDetails.etd).toLocaleDateString(
                              "es-ES"
                            )
                          : "No especificado"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        ETA (Fecha de Llegada)
                      </Label>
                      <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
                        {viewDetails.eta
                          ? new Date(viewDetails.eta).toLocaleDateString(
                              "es-ES"
                            )
                          : "No especificado"}
                      </p>
                    </div>
                  </div>
                </div>

                {viewDetails.tela && viewDetails.tela.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-4">
                      Telas ({viewDetails.tela.length})
                    </h3>
                    <div className="grid gap-2">
                      {viewDetails.tela.map((tela, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                        >
                          <Badge variant="outline" className="text-xs">
                            {index + 1}
                          </Badge>
                          <span className="text-sm">{tela.tipo_tela}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewDetails.notas && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-4">Notas</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap">
                      {viewDetails.notas}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : !showForm ? (
            // Vista de Lista de Órdenes de Compra de Logística
            <div className="space-y-4 py-4">
              {/* Barra de búsqueda */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por orden, contenedor, importador o tipo de tela..."
                  className="pl-10 w-full"
                />
              </div>

              <div className="grid gap-3 max-h-[350px] overflow-y-auto">
                {isLoadingLogistics ? (
                  <Card>
                    <CardContent className="flex items-center justify-center py-8">
                      <div className="text-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                        <p>Cargando órdenes de logística...</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : filteredLogisticsOrders.length === 0 ? (
                  <Card>
                    <CardContent className="flex items-center justify-center py-8">
                      <div className="text-center text-muted-foreground">
                        <TruckIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>
                          {searchQuery.trim()
                            ? "No se encontraron órdenes que coincidan con la búsqueda"
                            : "No hay órdenes de logística disponibles"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  filteredLogisticsOrders.map((logisticsOrder) => {
                    return (
                      <Card
                        key={logisticsOrder.orden_de_compra}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-lg font-semibold">
                              {logisticsOrder.orden_de_compra}
                            </span>

                            {/* Botones de acción */}
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleViewDetails(logisticsOrder)
                                    }
                                    className="h-8 w-8 p-0 hover:bg-gray-50 hover:border-gray-300"
                                  >
                                    <EyeIcon className="h-4 w-4 text-gray-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver detalles</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleEditOrder(logisticsOrder)
                                    }
                                    className="h-8 w-8 p-0 hover:bg-gray-50 hover:border-gray-300"
                                  >
                                    <EditIcon className="h-4 w-4 text-gray-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Editar orden</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteOrder(logisticsOrder)
                                    }
                                    disabled={isDeleting}
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300"
                                  >
                                    <TrashIcon className="h-4 w-4 text-red-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Eliminar orden</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // Vista de Formulario
            <div className="space-y-6 py-4">
              {/* Orden de Compra - Input libre */}
              <div className="space-y-2">
                <Label htmlFor="orden-compra">Orden de Compra *</Label>
                <Input
                  id="orden-compra"
                  type="text"
                  value={formData.orden_de_compra}
                  onChange={(e) =>
                    handleInputChange("orden_de_compra", e.target.value)
                  }
                  placeholder="Ingrese la orden de compra"
                  className={`w-full ${formErrors.orden_de_compra ? "border-red-500" : ""}`}
                />
                {formErrors.orden_de_compra && (
                  <p className="text-sm text-red-600">
                    {formErrors.orden_de_compra}
                  </p>
                )}
              </div>

              {/* Telas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Telas</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        tela: [...prev.tela, { tipo_tela: "" }],
                      }));
                    }}
                  >
                    Agregar Tela
                  </Button>
                </div>

                {formData.tela.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                    <p className="text-gray-500 mb-2">
                      No hay telas registradas
                    </p>
                    <p className="text-sm text-gray-400">
                      {formData.orden_de_compra.trim()
                        ? "Las telas se auto-popularon pero no se encontraron. Agregue manualmente."
                        : "Ingrese una orden de compra para auto-popular las telas o agregue manualmente."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.tela.map((tela, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Tela {index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                tela: prev.tela.filter((_, i) => i !== index),
                              }));
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Eliminar
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`tela-${index}-tipo`}>
                            Tipo de Tela
                          </Label>
                          <Input
                            id={`tela-${index}-tipo`}
                            type="text"
                            value={tela.tipo_tela}
                            onChange={(e) => {
                              const newTelas = [...formData.tela];
                              newTelas[index] = { tipo_tela: e.target.value };
                              setFormData((prev) => ({
                                ...prev,
                                tela: newTelas,
                              }));
                            }}
                            placeholder="Ej: MICRO VELBOA"
                            className={`w-full ${formErrors[`tela.${index}.tipo_tela`] ? "border-red-500" : ""}`}
                          />
                          {formErrors[`tela.${index}.tipo_tela`] && (
                            <p className="text-sm text-red-600">
                              {formErrors[`tela.${index}.tipo_tela`]}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contenedor */}
              <div className="space-y-2">
                <Label htmlFor="contenedor" className="flex items-center gap-2">
                  <ContainerIcon className="h-4 w-4" />
                  Contenedor
                </Label>
                <Input
                  id="contenedor"
                  type="text"
                  value={formData.contenedor}
                  onChange={(e) =>
                    handleInputChange("contenedor", e.target.value)
                  }
                  placeholder="Ej: TCLU1234567"
                  className={`w-full ${formErrors.contenedor ? "border-red-500" : ""}`}
                />
                {formErrors.contenedor && (
                  <p className="text-sm text-red-600">
                    {formErrors.contenedor}
                  </p>
                )}
              </div>

              {/* ETD y ETA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="etd" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    ETD (Estimated Time of Departure)
                  </Label>
                  <Input
                    id="etd"
                    type="date"
                    value={formData.etd}
                    onChange={(e) => handleInputChange("etd", e.target.value)}
                    className={formErrors.etd ? "border-red-500" : ""}
                    max="9999-12-31"
                    min="1000-01-01"
                  />
                  {formErrors.etd && (
                    <p className="text-sm text-red-600">{formErrors.etd}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eta" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    ETA (Estimated Time of Arrival)
                  </Label>
                  <Input
                    id="eta"
                    type="date"
                    value={formData.eta}
                    onChange={(e) => handleInputChange("eta", e.target.value)}
                    className={formErrors.eta ? "border-red-500" : ""}
                    max="9999-12-31"
                    min="1000-01-01"
                  />
                  {formErrors.eta && (
                    <p className="text-sm text-red-600">{formErrors.eta}</p>
                  )}
                </div>
              </div>

              {/* Importador */}
              <div className="space-y-2">
                <Label htmlFor="importador" className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Importador
                </Label>
                <Input
                  id="importador"
                  type="text"
                  value={formData.importador}
                  onChange={(e) =>
                    handleInputChange("importador", e.target.value)
                  }
                  placeholder="Nombre del importador"
                  className={`w-full ${formErrors.importador ? "border-red-500" : ""}`}
                />
                {formErrors.importador && (
                  <p className="text-sm text-red-600">
                    {formErrors.importador}
                  </p>
                )}
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="notas" className="flex items-center gap-2">
                  <NotebookPenIcon className="h-4 w-4" />
                  Notas
                </Label>
                <Textarea
                  id="notas"
                  value={formData.notas}
                  onChange={(e) => handleInputChange("notas", e.target.value)}
                  placeholder="Notas adicionales sobre la logística..."
                  rows={3}
                  className={`w-full resize-none ${formErrors.notas ? "border-red-500" : ""}`}
                />
                {formErrors.notas && (
                  <p className="text-sm text-red-600">{formErrors.notas}</p>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={viewDetails || showForm ? handleBackToList : onClose}
              disabled={isSubmitting}
            >
              {viewDetails || showForm ? "Regresar" : "Cancelar"}
            </Button>
            {showForm ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.orden_de_compra.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingOrder ? "Actualizando..." : "Guardando..."}
                  </>
                ) : editingOrder ? (
                  "Actualizar"
                ) : (
                  "Guardar"
                )}
              </Button>
            ) : !viewDetails ? (
              <Button onClick={handleShowForm}>Agregar</Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar */}
      <Dialog
        open={!!deleteConfirmation}
        onOpenChange={() => setDeleteConfirmation(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <TrashIcon className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente
              toda la información logística.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">
                <strong>Orden de compra:</strong>{" "}
                <span className="font-mono">
                  {deleteConfirmation?.orden_de_compra}
                </span>
              </p>
              {deleteConfirmation?.contenedor && (
                <p className="text-sm text-red-800 mt-1">
                  <strong>Contenedor:</strong> {deleteConfirmation.contenedor}
                </p>
              )}
              {deleteConfirmation?.tela &&
                deleteConfirmation.tela.length > 0 && (
                  <p className="text-sm text-red-800 mt-1">
                    <strong>Telas registradas:</strong>{" "}
                    {deleteConfirmation.tela.length}
                  </p>
                )}
            </div>

            <p className="text-sm text-gray-600">
              ¿Está seguro de que desea eliminar esta información logística?
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              onClick={cancelDeleteOrder}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteOrder}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
