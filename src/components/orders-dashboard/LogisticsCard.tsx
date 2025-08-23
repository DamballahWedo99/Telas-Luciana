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
  EditIcon,
  TrashIcon,
  PlusIcon,
} from "lucide-react";
import { logisticsSchema } from "@/lib/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  etd: string;
  eta: string;
  importador: string;
  notas: string;
  fecha_registro?: string;
  fecha_actualizacion?: string;
}

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

export const LogisticsCard: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isLoadingLogistics, setIsLoadingLogistics] = useState(false);
  const [logisticsOrders, setLogisticsOrders] = useState<LogisticsData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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

  useEffect(() => {
    loadLogisticsOrders();
  }, []);

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

  const handleEditOrder = (order: LogisticsData) => {
    setEditingOrder(order);
    setOriginalOrderName(order.orden_de_compra);
    setFormData({
      ...order,
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
    const validation = logisticsSchema.safeParse(formData);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((error) => {
        const path = error.path.join(".");
        errors[path] = error.message;
      });
      setFormErrors(errors);

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
      await loadLogisticsOrders();
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

  const LogisticsOrderItem: React.FC<{ order: LogisticsData }> = ({
    order,
  }) => {
    if (isMobile) {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header móvil con gradiente sutil */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <TruckIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-mono font-bold text-gray-900 text-sm truncate">
                  {order.orden_de_compra}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Orden de Compra</p>
              </div>
            </div>
          </div>

          {/* Contenido principal con padding mejorado */}
          <div className="p-4 space-y-4">
            {/* Badges principales en grid responsivo */}
            <div className="grid grid-cols-2 gap-2">
              {order.contenedor && (
                <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                  <ContainerIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-blue-800 truncate">
                      {order.contenedor}
                    </p>
                    <p className="text-xs text-blue-600">Contenedor</p>
                  </div>
                </div>
              )}

              {order.importador && (
                <div className="flex items-center gap-2 bg-purple-50 rounded-lg p-2.5 border border-purple-100">
                  <UserIcon className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-purple-800 truncate">
                      {order.importador}
                    </p>
                    <p className="text-xs text-purple-600">Importador</p>
                  </div>
                </div>
              )}
            </div>

            {/* Fechas con mejor jerarquía visual */}
            {(order.etd || order.eta) && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Cronograma
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {order.etd && (
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs font-medium text-green-800">
                          ETD
                        </span>
                      </div>
                      <p className="text-sm font-bold text-green-900">
                        {order.etd.split('T')[0].split('-').reverse().join('/')}
                      </p>
                    </div>
                  )}

                  {order.eta && (
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-orange-600" />
                        <span className="text-xs font-medium text-orange-800">
                          ETA
                        </span>
                      </div>
                      <p className="text-sm font-bold text-orange-900">
                        {order.eta.split('T')[0].split('-').reverse().join('/')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Telas con diseño mejorado */}
            {order.tela && order.tela.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Telas ({order.tela.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {order.tela.map((tela, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                    >
                      {tela.tipo_tela}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notas con mejor presentación */}
            {order.notas && order.notas.trim() && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <NotebookPenIcon className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                    Notas
                  </span>
                </div>
                <p className="text-sm text-amber-900 leading-relaxed">
                  {order.notas}
                </p>
              </div>
            )}
          </div>

          {/* Botones de acción con mejor UX */}
          <div className="px-4 pb-4">
            <div className="flex gap-2">
              <button
                onClick={() => handleEditOrder(order)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-all duration-150 transform active:scale-95"
              >
                <EditIcon className="h-4 w-4" />
                Editar
              </button>
              <button
                onClick={() => handleDeleteOrder(order)}
                disabled={isDeleting}
                className="px-3 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-150 transform active:scale-95 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Diseño desktop (original mejorado)
    return (
      <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
        {/* Header con OC y acciones */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-mono text-lg font-bold text-gray-900 mb-1">
              {order.orden_de_compra}
            </h3>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {order.contenedor && (
                <div className="flex items-center gap-1">
                  <ContainerIcon className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-md text-sm">
                    {order.contenedor}
                  </span>
                </div>
              )}
              {order.importador && (
                <div className="flex items-center gap-1">
                  <UserIcon className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-md text-sm">
                    {order.importador}
                  </span>
                </div>
              )}
              {order.etd && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md text-sm">
                    ETD: {order.etd.split('T')[0].split('-').reverse().join('/')}
                  </span>
                </div>
              )}
              {order.eta && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-md text-sm">
                    ETA: {order.eta.split('T')[0].split('-').reverse().join('/')}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditOrder(order)}
                    className="h-9 px-3"
                  >
                    <EditIcon className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Editar información logística</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteOrder(order)}
                    disabled={isDeleting}
                    className="h-9 px-3 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Eliminar información logística</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Telas */}
        {order.tela && order.tela.length > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                Telas ({order.tela.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {order.tela.map((tela, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs bg-white border-blue-200 text-blue-800 font-medium"
                >
                  {tela.tipo_tela}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Notas */}
        {order.notas && order.notas.trim() && (
          <div className="bg-amber-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <NotebookPenIcon className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Notas</span>
            </div>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">
              {order.notas}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      {isMobile ? (
        <div className="min-h-screen bg-gray-50">
          {/* Header móvil mejorado con sticky positioning */}
          <div className="sticky top-0 z-10 bg-gray-50 py-4">
            <div className="mx-4 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
              {/* Título y estadísticas */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 rounded-xl">
                    <TruckIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">
                      Logística
                    </h1>
                    <p className="text-sm text-gray-500">
                      {filteredLogisticsOrders.length} órdenes activas
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleShowForm}
                  className="p-3 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-all duration-150 transform active:scale-95"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Barra de búsqueda mejorada */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar órdenes, contenedores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Lista de órdenes móvil con mejor spacing */}
          <div className="px-4 py-4">
            {isLoadingLogistics ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 bg-blue-50 rounded-2xl mb-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Cargando órdenes
                </h3>
                <p className="text-gray-500 text-center">
                  Obteniendo la información logística más reciente...
                </p>
              </div>
            ) : filteredLogisticsOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 bg-gray-100 rounded-2xl mb-4">
                  <TruckIcon className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {searchQuery.trim() ? "Sin resultados" : "Sin órdenes"}
                </h3>
                <p className="text-gray-500 text-center max-w-sm">
                  {searchQuery.trim()
                    ? "No se encontraron órdenes que coincidan con tu búsqueda"
                    : "Agrega tu primera orden de logística para comenzar"}
                </p>
                {!searchQuery.trim() && (
                  <button
                    onClick={handleShowForm}
                    className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    Agregar Orden
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogisticsOrders.map((logisticsOrder, index) => (
                  <div
                    key={logisticsOrder.orden_de_compra}
                    className="animate-in slide-in-from-bottom-2 fade-in duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <LogisticsOrderItem order={logisticsOrder} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Card className=" shadow min-h-[80vh]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center mb-1">
                <TruckIcon className="mr-2 h-5 w-5" />
                Información Logística
              </CardTitle>
              <CardDescription>
                {filteredLogisticsOrders.length} órdenes de logística
                registradas
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      className="bg-black hover:bg-gray-800 rounded-full"
                      onClick={handleShowForm}
                    >
                      <PlusIcon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Agregar información logística</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>

          <CardContent>
            {/* Barra de búsqueda */}
            <div className="mb-4">
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
            </div>

            {/* Lista de órdenes */}
            <div className="grid gap-3 max-h-[65vh] overflow-y-auto">
              {isLoadingLogistics ? (
                <div className="flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p>Cargando órdenes de logística...</p>
                  </div>
                </div>
              ) : filteredLogisticsOrders.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center text-muted-foreground">
                    <TruckIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>
                      {searchQuery.trim()
                        ? "No se encontraron órdenes que coincidan con la búsqueda"
                        : "No hay órdenes de logística disponibles"}
                    </p>
                  </div>
                </div>
              ) : (
                filteredLogisticsOrders.map((logisticsOrder) => (
                  <LogisticsOrderItem
                    key={logisticsOrder.orden_de_compra}
                    order={logisticsOrder}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de formulario */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className={isMobile ? "max-w-[95vw] h-[85vh] overflow-hidden p-0 rounded-3xl [&>button]:hidden" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
          {isMobile ? (
            <>
              <div className="p-5 border-b bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-3xl">
                <DialogTitle className="text-lg font-semibold">
                  {editingOrder ? "Editar Información" : "Nueva OC"}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 mt-1">
                  {editingOrder
                    ? "Actualizar datos logísticos"
                    : "Complete los datos logísticos"}
                </DialogDescription>
              </div>
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                {/* Orden de Compra */}
                <div>
                  <Label htmlFor="orden-compra" className="text-sm font-medium text-gray-700">
                    Orden de Compra *
                  </Label>
                  <Input
                    id="orden-compra"
                    type="text"
                    value={formData.orden_de_compra}
                    onChange={(e) => handleInputChange("orden_de_compra", e.target.value)}
                    placeholder="Ingrese la orden de compra"
                    className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.orden_de_compra ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                  />
                  {formErrors.orden_de_compra && (
                    <p className="text-red-500 text-xs mt-1.5">{formErrors.orden_de_compra}</p>
                  )}
                </div>

                {/* Contenedor */}
                <div>
                  <Label htmlFor="contenedor" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <ContainerIcon className="h-4 w-4" />
                    Contenedor
                  </Label>
                  <Input
                    id="contenedor"
                    type="text"
                    value={formData.contenedor}
                    onChange={(e) => handleInputChange("contenedor", e.target.value)}
                    placeholder="Ej: TCLU1234567"
                    className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.contenedor ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                  />
                  {formErrors.contenedor && (
                    <p className="text-red-500 text-xs mt-1.5">{formErrors.contenedor}</p>
                  )}
                </div>

                {/* ETD */}
                <div>
                  <Label htmlFor="etd" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    ETD (Estimated Time of Departure)
                  </Label>
                  <Input
                    id="etd"
                    type="date"
                    value={formData.etd}
                    onChange={(e) => handleInputChange("etd", e.target.value)}
                    max="9999-12-31"
                    min="1000-01-01"
                    className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.etd ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                  />
                  {formErrors.etd && (
                    <p className="text-red-500 text-xs mt-1.5">{formErrors.etd}</p>
                  )}
                </div>

                {/* ETA */}
                <div>
                  <Label htmlFor="eta" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    ETA (Estimated Time of Arrival)
                  </Label>
                  <Input
                    id="eta"
                    type="date"
                    value={formData.eta}
                    onChange={(e) => handleInputChange("eta", e.target.value)}
                    max="9999-12-31"
                    min="1000-01-01"
                    className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.eta ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                  />
                  {formErrors.eta && (
                    <p className="text-red-500 text-xs mt-1.5">{formErrors.eta}</p>
                  )}
                </div>

                {/* Importador */}
                <div>
                  <Label htmlFor="importador" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    Importador
                  </Label>
                  <Input
                    id="importador"
                    type="text"
                    value={formData.importador}
                    onChange={(e) => handleInputChange("importador", e.target.value)}
                    placeholder="Nombre del importador"
                    className={`mt-1.5 w-full h-11 px-3 border rounded-lg focus:outline-none transition-colors ${formErrors.importador ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                  />
                  {formErrors.importador && (
                    <p className="text-red-500 text-xs mt-1.5">{formErrors.importador}</p>
                  )}
                </div>

                {/* Telas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium text-gray-700">Telas</Label>
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
                      <p className="text-gray-500 text-sm">No hay telas registradas</p>
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
                                  tela: prev.tela.filter((_, i) => i !== index),
                                }));
                              }}
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              ×
                            </Button>
                          </div>
                          <Input
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
                  <Label htmlFor="notas" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <NotebookPenIcon className="h-4 w-4" />
                    Notas
                  </Label>
                  <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => handleInputChange("notas", e.target.value)}
                    placeholder="Notas adicionales sobre la logística..."
                    rows={3}
                    className={`mt-1.5 w-full px-3 py-2 border rounded-lg focus:outline-none transition-colors resize-none ${formErrors.notas ? "border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                  />
                  {formErrors.notas && (
                    <p className="text-red-500 text-xs mt-1.5">{formErrors.notas}</p>
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
                    disabled={isSubmitting || !formData.orden_de_compra.trim()}
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
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editingOrder ? "Editar Información" : "Nueva OC"}
                </DialogTitle>
                <DialogDescription>
                  {editingOrder
                    ? "Actualizar datos logísticos"
                    : "Complete los datos logísticos"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Orden de Compra */}
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
                      <p className="text-gray-500 mb-2">No hay telas registradas</p>
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
                    <p className="text-sm text-red-600">{formErrors.contenedor}</p>
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
                    <p className="text-sm text-red-600">{formErrors.importador}</p>
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

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={handleBackToList}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar */}
      <Dialog
        open={!!deleteConfirmation}
        onOpenChange={() => setDeleteConfirmation(null)}
      >
        <DialogContent className={isMobile ? "max-w-[90vw] rounded-3xl" : "max-w-md"}>
          <DialogHeader className={isMobile ? "text-center" : ""}>
            <DialogTitle className={isMobile ? "flex items-center justify-center gap-2 text-lg text-red-600" : "flex items-center gap-2 text-red-600"}>
              <TrashIcon className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription className={isMobile ? "text-sm text-gray-600" : ""}>
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

            <p className={isMobile ? "text-sm text-gray-600 text-center" : "text-sm text-gray-600"}>
              ¿Está seguro de que desea eliminar esta información logística?
            </p>
          </div>

          {isMobile ? (
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
          ) : (
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
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
