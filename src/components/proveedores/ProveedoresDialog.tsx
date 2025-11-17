"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Search,
  User,
  Phone,
  Mail,
  Loader2,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { createProveedorSchema, type CreateProveedorFormValues } from "@/lib/zod";
import { ZodError } from "zod";

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

interface Proveedor {
  Empresa: string;
  "Nombre de contacto": string;
  Teléfono: string;
  Correo: string;
  Producto: string;
  fileKey?: string;
  _optimistic?: boolean;
}

interface ProveedoresDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function ProveedoresDialog({ open, setOpen }: ProveedoresDialogProps) {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "form">("list");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [proveedorForm, setProveedorForm] = useState<CreateProveedorFormValues>({
    Empresa: "",
    "Nombre de contacto": "",
    Teléfono: "",
    Correo: "",
    Producto: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proveedorToDelete, setProveedorToDelete] = useState<Proveedor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();

  const userRole = session?.user?.role || "";

  useEffect(() => {
    if (open) {
      loadProveedores();
      setView("list");
    }
  }, [open]);

  const loadProveedores = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/s3/proveedores");
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setProveedores(result.data || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Error al cargar proveedores"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const generateOptimisticFileKey = (empresa: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const empresaSlug = empresa
      .replace(/\s+/g, "_")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    return `Provedores/json/optimistic_${empresaSlug}_${timestamp}.json`;
  };

  const addProveedorOptimistic = (
    proveedorData: CreateProveedorFormValues
  ): Proveedor => {
    const optimisticProveedor: Proveedor = {
      Empresa: proveedorData.Empresa,
      "Nombre de contacto": proveedorData["Nombre de contacto"] || "",
      Teléfono: proveedorData.Teléfono || "",
      Correo: proveedorData.Correo,
      Producto: proveedorData.Producto || "",
      fileKey: generateOptimisticFileKey(proveedorData.Empresa),
      _optimistic: true,
    };

    setProveedores((prev) => [optimisticProveedor, ...prev]);
    return optimisticProveedor;
  };

  const updateProveedorOptimistic = (
    oldProveedor: Proveedor,
    newData: CreateProveedorFormValues
  ): void => {
    setProveedores((prev) =>
      prev.map((proveedor) =>
        proveedor.fileKey === oldProveedor.fileKey
          ? {
              Empresa: newData.Empresa,
              "Nombre de contacto": newData["Nombre de contacto"] || "",
              Teléfono: newData.Teléfono || "",
              Correo: newData.Correo,
              Producto: newData.Producto || "",
              fileKey: oldProveedor.fileKey,
              _optimistic: true,
            }
          : proveedor
      )
    );
  };

  const removeProveedorOptimistic = (proveedorToRemove: Proveedor): void => {
    setProveedores((prev) =>
      prev.filter((proveedor) => proveedor.fileKey !== proveedorToRemove.fileKey)
    );
  };

  const revertOptimisticChange = (originalProveedores: Proveedor[]): void => {
    setProveedores(originalProveedores);
  };

  const handleInputChange = (
    field: keyof CreateProveedorFormValues,
    value: string
  ) => {
    setProveedorForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (formErrors[field]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = (): boolean => {
    try {
      createProveedorSchema.parse(proveedorForm);
      setFormErrors({});
      return true;
    } catch (error) {
      const errors: Record<string, string> = {};
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            errors[err.path[0]] = err.message;
          }
        });
      }
      setFormErrors(errors);
      return false;
    }
  };

  const handleSubmitProveedor = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const isEditing = editingProveedor !== null;
    const originalProveedores = [...proveedores];

    try {
      if (isEditing) {
        updateProveedorOptimistic(editingProveedor, proveedorForm);
        
        const response = await fetch("/api/s3/proveedores", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...proveedorForm,
            fileKey: editingProveedor.fileKey,
          }),
        });

        if (!response.ok) {
          throw new Error("Error al actualizar proveedor");
        }
      } else {
        addProveedorOptimistic(proveedorForm);
        
        const response = await fetch("/api/s3/proveedores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(proveedorForm),
        });

        if (!response.ok) {
          throw new Error("Error al crear proveedor");
        }
      }

      toast.success(
        `Proveedor ${isEditing ? "actualizado" : "creado"} exitosamente`
      );

      // Remove optimistic updates and reload real data
      setProveedores(prev => prev.filter(p => !p._optimistic));
      await loadProveedores();

      resetForm();
      setView("list");
    } catch (error) {

      revertOptimisticChange(originalProveedores);

      toast.error(
        error instanceof Error
          ? error.message
          : `Error al ${editingProveedor ? "actualizar" : "crear"} el proveedor`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProveedor = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setProveedorForm({
      Empresa: proveedor.Empresa,
      "Nombre de contacto": proveedor["Nombre de contacto"],
      Teléfono: proveedor.Teléfono,
      Correo: proveedor.Correo,
      Producto: proveedor.Producto,
    });
    setView("form");
  };

  const handleDeleteProveedor = async () => {
    if (!proveedorToDelete) return;

    setIsDeleting(true);
    const originalProveedores = [...proveedores];

    try {
      removeProveedorOptimistic(proveedorToDelete);

      const response = await fetch("/api/s3/proveedores", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileKey: proveedorToDelete.fileKey }),
      });

      if (!response.ok) {
        throw new Error("Error al eliminar proveedor");
      }

      toast.success("Proveedor eliminado exitosamente");
      await loadProveedores();
    } catch {
      revertOptimisticChange(originalProveedores);
      toast.error("Error al eliminar el proveedor");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProveedorToDelete(null);
    }
  };

  const resetForm = () => {
    setProveedorForm({
      Empresa: "",
      "Nombre de contacto": "",
      Teléfono: "",
      Correo: "",
      Producto: "",
    });
    setFormErrors({});
    setEditingProveedor(null);
  };

  const filteredProveedores = proveedores.filter(proveedor =>
    proveedor.Empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor["Nombre de contacto"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor.Correo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor.Producto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = ["admin", "major_admin", "seller"].includes(userRole);
  const canDelete = ["admin", "major_admin"].includes(userRole);

  if (!open) return null;

  const renderListView = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Cargando proveedores...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-8 text-red-500">
          <p>{error}</p>
          <Button
            onClick={loadProveedores}
            variant="outline"
            className="mt-4"
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (filteredProveedores.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No se encontraron proveedores</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredProveedores.map((proveedor, index) => (
          <Card
            key={proveedor.fileKey || index}
            className={`transition-all duration-200 hover:shadow-md ${
              proveedor._optimistic ? "opacity-60" : ""
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {proveedor.Empresa}
                  </h3>
                  {proveedor["Nombre de contacto"] && (
                    <div className="flex items-center mt-1 text-sm text-gray-600">
                      <User className="h-4 w-4 mr-1" />
                      {proveedor["Nombre de contacto"]}
                    </div>
                  )}
                </div>
                {(canEdit || canDelete) && (
                  <div className="flex gap-1">
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditProveedor(proveedor)}
                        disabled={proveedor._optimistic}
                        className="h-8 w-8 p-0"
                        title="Editar proveedor"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProveedorToDelete(proveedor);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={proveedor._optimistic}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:border-red-300"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proveedor.Correo && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="truncate">{proveedor.Correo}</span>
                  </div>
                )}
                {proveedor.Teléfono && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{proveedor.Teléfono}</span>
                  </div>
                )}
              </div>
              {proveedor.Producto && (
                <div className="mt-3">
                  <Badge variant="secondary" className="text-xs">
                    <Package className="h-3 w-3 mr-1" />
                    {proveedor.Producto}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderFormView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label
          htmlFor="Empresa"
          className="text-sm font-medium text-gray-700"
        >
          Empresa *
        </Label>
        <Input
          id="Empresa"
          placeholder="Ej: Textiles González"
          value={proveedorForm.Empresa}
          onChange={(e) => handleInputChange("Empresa", e.target.value)}
          className={`mt-1.5 ${formErrors.Empresa ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
        />
        {formErrors.Empresa && (
          <p className="text-red-500 text-xs mt-1.5">
            {formErrors.Empresa}
          </p>
        )}
      </div>

      <div>
        <Label
          htmlFor="nombre-contacto"
          className="text-sm font-medium text-gray-700"
        >
          Nombre de contacto
        </Label>
        <Input
          id="nombre-contacto"
          placeholder="Ej: María González"
          value={proveedorForm["Nombre de contacto"]}
          onChange={(e) => handleInputChange("Nombre de contacto", e.target.value)}
          className={`mt-1.5 ${formErrors["Nombre de contacto"] ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
        />
        {formErrors["Nombre de contacto"] && (
          <p className="text-red-500 text-xs mt-1.5">
            {formErrors["Nombre de contacto"]}
          </p>
        )}
      </div>

      <div>
        <Label
          htmlFor="Correo"
          className="text-sm font-medium text-gray-700"
        >
          Correo *
        </Label>
        <Input
          id="Correo"
          type="email"
          placeholder="Ej: maria@textilesgonzalez.com"
          value={proveedorForm.Correo}
          onChange={(e) => handleInputChange("Correo", e.target.value)}
          className={`mt-1.5 ${formErrors.Correo ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
        />
        {formErrors.Correo && (
          <p className="text-red-500 text-xs mt-1.5">
            {formErrors.Correo}
          </p>
        )}
      </div>

      <div>
        <Label
          htmlFor="Teléfono"
          className="text-sm font-medium text-gray-700"
        >
          Teléfono
        </Label>
        <Input
          id="Teléfono"
          placeholder="Ej: 5512345678"
          value={proveedorForm.Teléfono}
          onChange={(e) => handleInputChange("Teléfono", e.target.value)}
          className={`mt-1.5 ${formErrors.Teléfono ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
        />
        {formErrors.Teléfono && (
          <p className="text-red-500 text-xs mt-1.5">
            {formErrors.Teléfono}
          </p>
        )}
      </div>

      <div className="md:col-span-2">
        <Label
          htmlFor="Producto"
          className="text-sm font-medium text-gray-700"
        >
          Producto
        </Label>
        <Input
          id="Producto"
          placeholder="Ej: Textiles, hilos, algodón..."
          value={proveedorForm.Producto}
          onChange={(e) => handleInputChange("Producto", e.target.value)}
          className={`mt-1.5 ${formErrors.Producto ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
        />
        {formErrors.Producto && (
          <p className="text-red-500 text-xs mt-1.5">
            {formErrors.Producto}
          </p>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[95vw] h-[85vh] overflow-hidden p-0 rounded-3xl [&>button]:hidden">
            {view === "list" ? (
              <>
                <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 rounded-2xl">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-lg font-semibold">
                        Directorio de Proveedores
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600">
                        Directorio completo de proveedores
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-[400px]">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Buscar proveedores..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-xl h-12 bg-gray-50 border-gray-200 focus:bg-white"
                      />
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-4 bg-blue-50 rounded-full">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      </div>
                      <p className="text-gray-600 font-medium">
                        Cargando directorio de proveedores...
                      </p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-6 bg-red-50 rounded-full">
                        <Package className="h-12 w-12 text-red-400" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="font-semibold text-gray-900">
                          Error al cargar proveedores
                        </h3>
                        <p className="text-sm text-gray-500">{error}</p>
                        <Button
                          onClick={loadProveedores}
                          variant="outline"
                          size="sm"
                          className="mt-2"
                        >
                          Reintentar
                        </Button>
                      </div>
                    </div>
                  ) : filteredProveedores.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-6 bg-gray-50 rounded-full">
                        <Package className="h-12 w-12 text-gray-400" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="font-semibold text-gray-900">
                          No hay proveedores
                        </h3>
                        <p className="text-sm text-gray-500">
                          No se encontraron proveedores con esos criterios.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto px-1">
                      {filteredProveedores.map((proveedor, index) => (
                        <Card
                          key={proveedor.fileKey || index}
                          className={`bg-white border shadow-sm ${proveedor._optimistic ? "opacity-75 border-dashed border-blue-300" : ""}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                                <Package className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1">
                                    {proveedor.Empresa}
                                  </h3>
                                  {proveedor._optimistic && (
                                    <div className="flex items-center">
                                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                    </div>
                                  )}
                                </div>
                                {proveedor["Nombre de contacto"] && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <User className="h-4 w-4 flex-shrink-0" />
                                    <span className="text-sm">{proveedor["Nombre de contacto"]}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {canEdit && !proveedor._optimistic && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditProveedor(proveedor)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete && !proveedor._optimistic && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setProveedorToDelete(proveedor);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:border-red-300"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              <div className="space-y-2 text-sm">
                                {proveedor.Correo && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-600 text-xs break-all">
                                      {proveedor.Correo}
                                    </span>
                                  </div>
                                )}
                                {proveedor.Teléfono && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-600">{proveedor.Teléfono}</span>
                                  </div>
                                )}
                              </div>
                              {proveedor.Producto && (
                                <div className="mt-3">
                                  <Badge variant="secondary" className="text-xs">
                                    <Package className="h-3 w-3 mr-1" />
                                    {proveedor.Producto}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t bg-gray-50/80 backdrop-blur-sm rounded-b-3xl">
                  <div className="text-center text-xs text-gray-500 mb-3">
                    {filteredProveedores.length} de {proveedores.length} proveedores
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      className="flex-1 h-11 font-medium rounded-xl border-gray-300"
                    >
                      Cerrar
                    </Button>
                    {canEdit && (
                      <Button
                        onClick={() => setView("form")}
                        className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-5 border-b bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-3xl">
                  <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetForm();
                        setView("list");
                      }}
                      className="mr-2 h-8 w-8 p-0 rounded-lg"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    {editingProveedor ? (
                      <Edit className="h-5 w-5" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                    {editingProveedor ? "Editar Proveedor" : "Agregar Nuevo Proveedor"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 mt-1 ml-12">
                    {editingProveedor
                      ? "Actualiza la información del proveedor"
                      : "Crea un nuevo proveedor"}
                  </DialogDescription>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <Label
                      htmlFor="Empresa"
                      className="text-sm font-medium text-gray-700"
                    >
                      Empresa *
                    </Label>
                    <Input
                      id="Empresa"
                      placeholder="Ej: Textiles González"
                      value={proveedorForm.Empresa}
                      onChange={(e) => handleInputChange("Empresa", e.target.value)}
                      className={`mt-1.5 h-11 ${formErrors.Empresa ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.Empresa && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.Empresa}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="nombre-contacto"
                      className="text-sm font-medium text-gray-700"
                    >
                      Nombre de contacto
                    </Label>
                    <Input
                      id="nombre-contacto"
                      placeholder="Ej: María González"
                      value={proveedorForm["Nombre de contacto"]}
                      onChange={(e) => handleInputChange("Nombre de contacto", e.target.value)}
                      className={`mt-1.5 h-11 ${formErrors["Nombre de contacto"] ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors["Nombre de contacto"] && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors["Nombre de contacto"]}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="Correo"
                      className="text-sm font-medium text-gray-700"
                    >
                      Correo *
                    </Label>
                    <Input
                      id="Correo"
                      type="email"
                      placeholder="Ej: maria@textilesgonzalez.com"
                      value={proveedorForm.Correo}
                      onChange={(e) => handleInputChange("Correo", e.target.value)}
                      className={`mt-1.5 h-11 ${formErrors.Correo ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.Correo && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.Correo}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="Teléfono"
                      className="text-sm font-medium text-gray-700"
                    >
                      Teléfono
                    </Label>
                    <Input
                      id="Teléfono"
                      placeholder="Ej: 5512345678"
                      value={proveedorForm.Teléfono}
                      onChange={(e) => handleInputChange("Teléfono", e.target.value)}
                      className={`mt-1.5 h-11 ${formErrors.Teléfono ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.Teléfono && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.Teléfono}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="Producto"
                      className="text-sm font-medium text-gray-700"
                    >
                      Producto
                    </Label>
                    <Input
                      id="Producto"
                      placeholder="Ej: Textiles, hilos, algodón..."
                      value={proveedorForm.Producto}
                      onChange={(e) => handleInputChange("Producto", e.target.value)}
                      className={`mt-1.5 h-11 ${formErrors.Producto ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.Producto && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.Producto}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-5 border-t bg-gray-50/80 backdrop-blur-sm rounded-b-3xl">
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setView("list");
                      }}
                      disabled={isSubmitting}
                      className="flex-1 h-11 border-gray-300 rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmitProveedor}
                      disabled={isSubmitting}
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 shadow-sm rounded-xl"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingProveedor ? "Actualizando..." : "Creando..."}
                        </>
                      ) : (
                        <>
                          {editingProveedor ? (
                            <Edit className="mr-2 h-4 w-4" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          {editingProveedor ? "Actualizar" : "Crear"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-[90vw] rounded-3xl">
            <AlertDialogHeader className="text-center">
              <AlertDialogTitle className="text-lg">
                ¿Estás seguro?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600">
                Esta acción no se puede deshacer. Se eliminará permanentemente
                el proveedor <strong>{proveedorToDelete?.Empresa}</strong> del
                directorio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-3 sm:gap-3">
              <AlertDialogCancel
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl border-gray-300"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProveedor}
                disabled={isDeleting}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 focus:ring-red-600 rounded-xl"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {view === "form" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetForm();
                  setView("list");
                }}
                className="mr-2 h-8 w-8 p-0 rounded-lg"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Package className="h-5 w-5" />
            <div>
              <DialogTitle>
                {view === "list"
                  ? "Directorio de Proveedores"
                  : editingProveedor
                    ? "Editar Proveedor"
                    : "Agregar Nuevo Proveedor"}
              </DialogTitle>
              <DialogDescription>
                {view === "list"
                  ? "Directorio completo de proveedores y sus datos de contacto"
                  : editingProveedor
                    ? "Actualiza la información del proveedor"
                    : "Crea un nuevo proveedor"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {view === "list" ? (
            <>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar por empresa, contacto, correo o producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {renderListView()}
              </div>

              <div className="mt-4 pt-3 border-t flex justify-end">
                {canEdit && (
                  <Button
                    onClick={() => setView("form")}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Proveedor
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {renderFormView()}
              </div>

              <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setView("list");
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitProveedor}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingProveedor ? "Actualizando..." : "Creando..."}
                    </>
                  ) : (
                    <>
                      {editingProveedor ? (
                        <Edit className="mr-2 h-4 w-4" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      {editingProveedor ? "Actualizar" : "Crear"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              proveedor{" "}
              <span className="font-semibold">
                {proveedorToDelete?.Empresa}
              </span>{" "}
              del directorio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProveedor}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}