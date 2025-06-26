"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  Loader2,
  Plus,
  MessageSquare,
  Edit,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { createClienteSchema, type CreateClienteFormValues } from "@/lib/zod";
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

interface Cliente {
  empresa: string;
  contacto: string;
  direccion: string;
  telefono: string;
  email: string;
  vendedor: string;
  ubicacion: string;
  comentarios: string;
  fileKey?: string;
}

interface ClientesDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function ClientesDialog({ open, setOpen }: ClientesDialogProps) {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "form">("list");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [clienteForm, setClienteForm] = useState<CreateClienteFormValues>({
    empresa: "",
    contacto: "",
    direccion: "",
    telefono: "",
    email: "",
    vendedor: "",
    ubicacion: "",
    comentarios: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();

  const userRole = session?.user?.role || "";
  const userName = session?.user?.name || "";

  const getVendedorForUser = (name: string, role: string): string => {
    if (role !== "seller") {
      return "TTL";
    }
    return name || "TTL";
  };

  useEffect(() => {
    if (open) {
      loadClientes();
      setView("list");
    }
  }, [open]);

  const loadClientes = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/s3/clientes");

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const jsonData = await response.json();

      if (jsonData.error) {
        throw new Error(jsonData.error);
      }

      if (!jsonData.data || !Array.isArray(jsonData.data)) {
        throw new Error("Formato de datos inválido");
      }

      setClientes(jsonData.data);
    } catch (error) {
      console.error("Error loading clientes:", error);
      setError(
        error instanceof Error ? error.message : "Error al cargar clientes"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof CreateClienteFormValues,
    value: string
  ) => {
    setClienteForm((prev) => ({
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
      createClienteSchema.parse(clienteForm);
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

  const handleSubmitCliente = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const isEditing = editingCliente !== null;
      const url = "/api/s3/clientes";
      const method = isEditing ? "PUT" : "POST";
      const body = isEditing
        ? { ...clienteForm, fileKey: editingCliente.fileKey }
        : clienteForm;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Error al ${isEditing ? "actualizar" : "crear"} el cliente`
        );
      }

      toast.success(
        `Cliente ${isEditing ? "actualizado" : "creado"} exitosamente`
      );

      resetForm();
      setView("list");
      await loadClientes();
    } catch (error) {
      console.error("Error submitting cliente:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Error al ${editingCliente ? "actualizar" : "crear"} el cliente`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCliente = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setClienteForm({
      empresa: cliente.empresa,
      contacto: cliente.contacto,
      direccion: cliente.direccion,
      telefono: cliente.telefono,
      email: cliente.email,
      vendedor: cliente.vendedor,
      ubicacion: cliente.ubicacion,
      comentarios: cliente.comentarios,
    });
    setView("form");
  };

  const handleNewCliente = () => {
    setEditingCliente(null);
    resetForm();

    const autoVendedor = getVendedorForUser(userName, userRole);
    setClienteForm({
      empresa: "",
      contacto: "",
      direccion: "",
      telefono: "",
      email: "",
      vendedor: autoVendedor,
      ubicacion: "",
      comentarios: "",
    });

    setView("form");
  };

  const handleDeleteCliente = (cliente: Cliente) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCliente = async () => {
    if (!clienteToDelete?.fileKey) {
      toast.error("No se puede eliminar el cliente: información incompleta");
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/s3/clientes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileKey: clienteToDelete.fileKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar el cliente");
      }

      toast.success("Cliente eliminado exitosamente");
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
      await loadClientes();
    } catch (error) {
      console.error("Error deleting cliente:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al eliminar el cliente"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const canEditCliente = (cliente: Cliente): boolean => {
    if (userRole === "admin" || userRole === "major_admin") {
      return true;
    }

    if (userRole === "seller") {
      const validVendedor = getVendedorForUser(userName, userRole);
      return cliente.vendedor === validVendedor;
    }

    return false;
  };

  const canDeleteClients = userRole === "admin" || userRole === "major_admin";

  const filteredClientes = clientes.filter(
    (cliente) =>
      (cliente.empresa || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (cliente.contacto || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (cliente.vendedor || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (cliente.ubicacion || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (cliente.comentarios || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const getVendedorColor = (vendedor: string) => {
    const colors = [
      "bg-blue-100 text-blue-800 hover:bg-blue-200",
      "bg-pink-100 text-pink-800 hover:bg-pink-200",
      "bg-green-100 text-green-800 hover:bg-green-200",
      "bg-purple-100 text-purple-800 hover:bg-purple-200",
      "bg-orange-100 text-orange-800 hover:bg-orange-200",
      "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
      "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
      "bg-red-100 text-red-800 hover:bg-red-200",
    ];

    if (vendedor === "TTL") {
      return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }

    let hash = 0;
    for (let i = 0; i < vendedor.length; i++) {
      hash = vendedor.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;

    return colors[colorIndex];
  };

  const handleCancel = () => {
    if (view === "form") {
      setView("list");
      setEditingCliente(null);
      resetForm();
    } else {
      setOpen(false);
      setSearchTerm("");
      setError("");
    }
  };

  const resetForm = () => {
    const autoVendedor = getVendedorForUser(userName, userRole);

    setClienteForm({
      empresa: "",
      contacto: "",
      direccion: "",
      telefono: "",
      email: "",
      vendedor: autoVendedor,
      ubicacion: "",
      comentarios: "",
    });
    setFormErrors({});
  };

  const ClienteCard = ({
    cliente,
    isMobileVersion = false,
  }: {
    cliente: Cliente;
    isMobileVersion?: boolean;
  }) => {
    const canEdit = canEditCliente(cliente);

    if (isMobileVersion) {
      return (
        <Card className="bg-white border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1">
                  {cliente.empresa}
                </h3>
                {cliente.contacto && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{cliente.contacto}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditCliente(cliente)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {canDeleteClients && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCliente(cliente)}
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
              {(cliente.vendedor || cliente.ubicacion) && (
                <div className="flex gap-2 flex-wrap">
                  {cliente.vendedor && (
                    <Badge
                      className={getVendedorColor(cliente.vendedor)}
                      variant="secondary"
                    >
                      <UserCheck className="h-3 w-3 mr-1" />
                      {cliente.vendedor}
                    </Badge>
                  )}
                  {cliente.ubicacion && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      {cliente.ubicacion}
                    </Badge>
                  )}
                </div>
              )}

              <div className="space-y-2 text-sm">
                {cliente.direccion && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 leading-relaxed">
                      {cliente.direccion}
                    </span>
                  </div>
                )}
                {cliente.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">{cliente.telefono}</span>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 text-xs break-all">
                      {cliente.email}
                    </span>
                  </div>
                )}
                {cliente.comentarios && (
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 text-xs leading-relaxed italic break-words overflow-hidden">
                      {cliente.comentarios}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-white border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4 flex-1">
              <div className="flex-shrink-0">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 text-base">
                      {cliente.empresa}
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      {cliente.vendedor && (
                        <Badge className={getVendedorColor(cliente.vendedor)}>
                          <UserCheck className="h-3 w-3 mr-1" />
                          {cliente.vendedor}
                        </Badge>
                      )}
                      {cliente.ubicacion && (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {cliente.ubicacion}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {cliente.contacto && (
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium text-sm">
                        {cliente.contacto}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {cliente.direccion && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600 break-words">
                        {cliente.direccion}
                      </span>
                    </div>
                  )}
                  {cliente.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600">{cliente.telefono}</span>
                    </div>
                  )}
                  {cliente.email && (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 break-all">
                        {cliente.email}
                      </span>
                    </div>
                  )}
                  {cliente.comentarios && (
                    <div className="flex items-start gap-2 md:col-span-2">
                      <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600 text-sm leading-relaxed italic">
                        {cliente.comentarios}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 ml-4">
              <div className="flex gap-1">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditCliente(cliente)}
                    className="h-8 w-8 p-0"
                    title="Editar cliente"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {canDeleteClients && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCliente(cliente)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:border-red-300"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const isEditing = editingCliente !== null;

  if (!session) {
    return null;
  }

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
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-lg font-semibold">
                        Directorio de Clientes
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600">
                        Directorio completo de clientes
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-[400px]">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Buscar cliente..."
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
                        Cargando directorio de clientes...
                      </p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-6 bg-red-50 rounded-full">
                        <Building2 className="h-12 w-12 text-red-400" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="font-semibold text-gray-900">
                          Error al cargar clientes
                        </h3>
                        <p className="text-sm text-gray-500">{error}</p>
                        <Button
                          onClick={loadClientes}
                          variant="outline"
                          size="sm"
                          className="mt-2"
                        >
                          Reintentar
                        </Button>
                      </div>
                    </div>
                  ) : filteredClientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-6 bg-gray-50 rounded-full">
                        <Building2 className="h-12 w-12 text-gray-400" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="font-semibold text-gray-900">
                          No hay clientes
                        </h3>
                        <p className="text-sm text-gray-500">
                          No se encontraron clientes con esos criterios.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto px-1">
                      {filteredClientes.map((cliente, index) => (
                        <ClienteCard
                          key={index}
                          cliente={cliente}
                          isMobileVersion={true}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t bg-gray-50/80 backdrop-blur-sm rounded-b-3xl">
                  <div className="text-center text-xs text-gray-500 mb-3">
                    {filteredClientes.length} de {clientes.length} clientes
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      className="flex-1 h-11 font-medium rounded-xl border-gray-300"
                    >
                      Cerrar
                    </Button>
                    <Button
                      onClick={handleNewCliente}
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar
                    </Button>
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
                      onClick={() => setView("list")}
                      className="mr-2 h-8 w-8 p-0 rounded-lg"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    {isEditing ? (
                      <Edit className="h-5 w-5" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                    {isEditing ? "Editar Cliente" : "Agregar Nuevo Cliente"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 mt-1 ml-12">
                    {isEditing
                      ? "Actualiza la información del cliente"
                      : `Crea un nuevo contacto`}
                  </DialogDescription>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <Label
                      htmlFor="empresa"
                      className="text-sm font-medium text-gray-700"
                    >
                      Empresa *
                    </Label>
                    <Input
                      id="empresa"
                      placeholder="Ej: Textiles González"
                      value={clienteForm.empresa}
                      onChange={(e) =>
                        handleInputChange("empresa", e.target.value)
                      }
                      className={`mt-1.5 h-11 ${formErrors.empresa ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.empresa && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.empresa}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="contacto"
                      className="text-sm font-medium text-gray-700"
                    >
                      Contacto
                    </Label>
                    <Input
                      id="contacto"
                      placeholder="Ej: María González"
                      value={clienteForm.contacto}
                      onChange={(e) =>
                        handleInputChange("contacto", e.target.value)
                      }
                      className={`mt-1.5 h-11 ${formErrors.contacto ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.contacto && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.contacto}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="direccion"
                      className="text-sm font-medium text-gray-700"
                    >
                      Dirección
                    </Label>
                    <Input
                      id="direccion"
                      placeholder="Ej: Av. Insurgentes Sur 1234"
                      value={clienteForm.direccion}
                      onChange={(e) =>
                        handleInputChange("direccion", e.target.value)
                      }
                      className={`mt-1.5 h-11 ${formErrors.direccion ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.direccion && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.direccion}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="telefono"
                      className="text-sm font-medium text-gray-700"
                    >
                      Teléfono
                    </Label>
                    <Input
                      id="telefono"
                      placeholder="Ej: 5512345678"
                      value={clienteForm.telefono}
                      onChange={(e) =>
                        handleInputChange("telefono", e.target.value)
                      }
                      className={`mt-1.5 h-11 ${formErrors.telefono ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.telefono && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.telefono}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-gray-700"
                    >
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Ej: maria@textilesgonzalez.com"
                      value={clienteForm.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      className={`mt-1.5 h-11 ${formErrors.email ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.email && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="ubicacion"
                      className="text-sm font-medium text-gray-700"
                    >
                      Ubicación
                    </Label>
                    <Input
                      id="ubicacion"
                      placeholder="Ej: CDMX, Mérida, Guadalajara..."
                      value={clienteForm.ubicacion}
                      onChange={(e) =>
                        handleInputChange("ubicacion", e.target.value)
                      }
                      className={`mt-1.5 h-11 ${formErrors.ubicacion ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.ubicacion && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.ubicacion}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="comentarios"
                      className="text-sm font-medium text-gray-700"
                    >
                      Comentarios
                    </Label>
                    <Textarea
                      id="comentarios"
                      placeholder="Ej: Cliente preferencial, requiere atención especial..."
                      value={clienteForm.comentarios}
                      onChange={(e) =>
                        handleInputChange("comentarios", e.target.value)
                      }
                      className={`mt-1.5 min-h-[80px] resize-none ${formErrors.comentarios ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                    />
                    {formErrors.comentarios && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {formErrors.comentarios}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-5 border-t bg-gray-50/80 backdrop-blur-sm rounded-b-3xl">
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="flex-1 h-11 border-gray-300 rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmitCliente}
                      disabled={isSubmitting}
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 shadow-sm rounded-xl"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isEditing ? "Actualizando..." : "Creando..."}
                        </>
                      ) : (
                        <>
                          {isEditing ? (
                            <Edit className="mr-2 h-4 w-4" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          {isEditing ? "Actualizar" : "Crear"}
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
                el cliente <strong>{clienteToDelete?.empresa}</strong> del
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
                onClick={confirmDeleteCliente}
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <div>
                <DialogTitle>Índice de Clientes</DialogTitle>
                <DialogDescription>
                  Directorio completo de clientes y sus datos de contacto
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por empresa, contacto, vendedor o ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="p-4 bg-blue-50 rounded-full">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                  <p className="text-gray-600 font-medium">
                    Cargando directorio de clientes...
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="p-6 bg-red-50 rounded-full">
                    <Building2 className="h-12 w-12 text-red-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-gray-900">
                      Error al cargar clientes
                    </h3>
                    <p className="text-sm text-gray-500">{error}</p>
                    <Button
                      onClick={loadClientes}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : filteredClientes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No se encontraron clientes</p>
                </div>
              ) : (
                filteredClientes.map((cliente, index) => (
                  <ClienteCard key={index} cliente={cliente} />
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t flex justify-end">
              <Button
                onClick={handleNewCliente}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              cliente <strong>{clienteToDelete?.empresa}</strong> del
              directorio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCliente}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
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
