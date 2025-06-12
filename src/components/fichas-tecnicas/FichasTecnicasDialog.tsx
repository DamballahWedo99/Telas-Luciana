"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Loader2,
  Upload,
  Settings,
  Calendar,
  HardDrive,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface FichasTecnicasDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface FichaTecnica {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  allowedRoles: string[];
}

interface UploadFormData {
  fileName: string;
  archivo: File | null;
  tipoPermiso: "admin" | "todos";
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

const FichasTecnicasDialog: React.FC<FichasTecnicasDialogProps> = ({
  open,
  setOpen,
}) => {
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [fichaSeleccionada, setFichaSeleccionada] = useState<string>("");
  const [isLoadingFichas, setIsLoadingFichas] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fichaToDelete, setFichaToDelete] = useState<FichaTecnica | null>(null);

  const [uploadForm, setUploadForm] = useState<UploadFormData>({
    fileName: "",
    archivo: null,
    tipoPermiso: "admin",
  });

  const userRole = session?.user?.role;
  const isSeller = userRole === "seller";

  const loadFichas = useCallback(async () => {
    if (!session?.user) return;

    setIsLoadingFichas(true);
    try {
      const response = await fetch("/api/s3/fichas-tecnicas");
      if (!response.ok) {
        throw new Error("Error al cargar fichas técnicas");
      }

      const data = await response.json();
      setFichas(data.fichas || []);
    } catch (error) {
      console.error("Error loading fichas:", error);
      toast.error("Error al cargar las fichas técnicas");
    } finally {
      setIsLoadingFichas(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (open && session?.user) {
      loadFichas();
    }
  }, [open, session?.user, loadFichas]);

  const handleDownload = async (fichaKey?: string) => {
    const keyToDownload = fichaKey || fichaSeleccionada;

    if (!keyToDownload) {
      toast.error("Selecciona una ficha técnica para descargar");
      return;
    }

    setIsLoading(true);
    if (fichaKey) setDownloadingId(fichaKey);

    try {
      const response = await fetch(
        `/api/s3/fichas-tecnicas/download?key=${encodeURIComponent(
          keyToDownload
        )}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Error al descargar la ficha técnica"
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const fileName = keyToDownload.split("/").pop() || "ficha-tecnica.pdf";
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Ficha técnica descargada exitosamente");
    } catch (error) {
      console.error("Error downloading ficha técnica:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al descargar la ficha técnica"
      );
    } finally {
      setIsLoading(false);
      setDownloadingId("");
    }
  };

  const handleDeleteFicha = async () => {
    if (!fichaToDelete) return;

    setDeletingId(fichaToDelete.key);

    try {
      const response = await fetch(
        `/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(
          fichaToDelete.key
        )}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Error al eliminar la ficha técnica"
        );
      }

      toast.success("Ficha técnica eliminada exitosamente");
      await loadFichas();
      setDeleteDialogOpen(false);
      setFichaToDelete(null);
    } catch (error) {
      console.error("Error deleting ficha técnica:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al eliminar la ficha técnica"
      );
    } finally {
      setDeletingId("");
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.fileName.trim()) {
      toast.error("Ingresa un nombre para la ficha técnica");
      return;
    }

    if (!uploadForm.archivo) {
      toast.error("Selecciona un archivo PDF");
      return;
    }

    setIsLoading(true);

    try {
      const allowedRoles =
        uploadForm.tipoPermiso === "admin"
          ? ["major_admin", "admin"]
          : ["major_admin", "admin", "seller"];

      const formData = new FormData();
      formData.append("file", uploadForm.archivo);
      formData.append("fileName", uploadForm.fileName);
      formData.append("allowedRoles", JSON.stringify(allowedRoles));

      const response = await fetch("/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al subir la ficha técnica");
      }

      toast.success("Ficha técnica subida exitosamente");

      setUploadForm({
        fileName: "",
        archivo: null,
        tipoPermiso: "admin",
      });

      await loadFichas();
    } catch (error) {
      console.error("Error uploading ficha técnica:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al subir la ficha técnica"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleCancel = () => {
    setOpen(false);
    setFichaSeleccionada("");
    setUploadForm({
      fileName: "",
      archivo: null,
      tipoPermiso: "admin",
    });
  };

  const getPermisoLabel = (roles: string[] | string) => {
    if (typeof roles === "string") {
      roles = roles.split("-");
    }
    return roles.includes("seller")
      ? "Todos los usuarios"
      : "Solo administradores";
  };

  const FichaCard = ({
    ficha,
    showAdminControls = false,
  }: {
    ficha: FichaTecnica;
    showAdminControls?: boolean;
  }) => (
    <div className="group relative bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl">
            <FileText className="h-6 w-6 text-red-600" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-5 mb-4 line-clamp-2">
            {ficha.name}
          </h3>

          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-5">
            <div className="flex items-center space-x-1">
              <HardDrive className="h-3 w-3" />
              <span>{formatFileSize(ficha.size)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(ficha.lastModified).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </div>

          {showAdminControls && (
            <div className="mb-4">
              <Badge
                variant={
                  getPermisoLabel(ficha.allowedRoles) === "Todos los usuarios"
                    ? "default"
                    : "secondary"
                }
                className="text-xs"
              >
                {getPermisoLabel(ficha.allowedRoles)}
              </Badge>
            </div>
          )}

          <div className={`${showAdminControls ? "flex space-x-2" : ""}`}>
            <Button
              onClick={() => handleDownload(ficha.key)}
              disabled={downloadingId === ficha.key}
              className={`${
                showAdminControls ? "flex-1" : "w-full"
              } bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl h-10 text-sm font-medium shadow-sm`}
            >
              {downloadingId === ficha.key ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Descargando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </>
              )}
            </Button>

            {showAdminControls && (
              <Button
                onClick={() => {
                  setFichaToDelete(ficha);
                  setDeleteDialogOpen(true);
                }}
                disabled={deletingId === ficha.key}
                variant="destructive"
                size="icon"
                className="rounded-xl h-10 w-10"
              >
                {deletingId === ficha.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isSeller && isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden p-0 rounded-3xl [&>button]:hidden">
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-blue-100 rounded-2xl">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              Fichas Técnicas
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm">
              Toca cualquier PDF para descargarlo
            </DialogDescription>
          </div>

          <div className="p-4">
            {isLoadingFichas ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-4 bg-blue-50 rounded-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <p className="text-gray-600 font-medium">
                  Cargando fichas técnicas...
                </p>
              </div>
            ) : fichas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-6 bg-gray-50 rounded-full">
                  <FileText className="h-12 w-12 text-gray-400" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    No hay fichas disponibles
                  </h3>
                  <p className="text-sm text-gray-500">
                    No hay fichas técnicas disponibles para tu rol.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {fichas.map((ficha) => (
                  <FichaCard key={ficha.key} ficha={ficha} />
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50 rounded-b-3xl">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="w-full h-12 font-medium rounded-xl"
            >
              Cerrar
            </Button>
          </div>

          <style jsx>{`
            @keyframes slideInUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .line-clamp-2 {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          `}</style>
        </DialogContent>
      </Dialog>
    );
  }

  if (isSeller) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Fichas Técnicas
            </DialogTitle>
            <DialogDescription>
              Descarga fichas técnicas disponibles para tu rol.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingFichas ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-4 bg-blue-50 rounded-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <p className="text-gray-600 font-medium">
                  Cargando fichas técnicas...
                </p>
              </div>
            ) : fichas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-6 bg-gray-50 rounded-full">
                  <FileText className="h-12 w-12 text-gray-400" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    No hay fichas disponibles
                  </h3>
                  <p className="text-sm text-gray-500">
                    No hay fichas técnicas disponibles para tu rol.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto p-1">
                {fichas.map((ficha) => (
                  <FichaCard
                    key={ficha.key}
                    ficha={ficha}
                    showAdminControls={false}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Fichas Técnicas
          </DialogTitle>
          <DialogDescription>
            Descarga fichas técnicas disponibles según tu rol de usuario.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="descargar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="descargar">Descargar Fichas</TabsTrigger>
            <TabsTrigger value="administrar">
              <Settings className="h-4 w-4 mr-2" />
              Administrar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="descargar" className="space-y-4">
            {isLoadingFichas ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-4 bg-blue-50 rounded-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <p className="text-gray-600 font-medium">
                  Cargando fichas técnicas...
                </p>
              </div>
            ) : fichas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-6 bg-gray-50 rounded-full">
                  <FileText className="h-12 w-12 text-gray-400" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    No hay fichas disponibles
                  </h3>
                  <p className="text-sm text-gray-500">
                    No hay fichas técnicas disponibles.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto p-1">
                {fichas.map((ficha) => (
                  <FichaCard
                    key={ficha.key}
                    ficha={ficha}
                    showAdminControls={false}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="administrar" className="space-y-6">
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Subir Nueva Ficha Técnica
              </h3>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre del Archivo *</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Manual_Operacion_Maquina_X"
                    value={uploadForm.fileName}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        fileName: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">
                    Este será el nombre del archivo. No incluyas la extensión
                    .pdf
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="archivo">Archivo PDF *</Label>
                  <Input
                    id="archivo"
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        archivo: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Permisos de Visualización *</Label>
                  <Select
                    value={uploadForm.tipoPermiso}
                    onValueChange={(value: "admin" | "todos") =>
                      setUploadForm((prev) => ({ ...prev, tipoPermiso: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        Solo administradores
                      </SelectItem>
                      <SelectItem value="todos">Todos los usuarios</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir Ficha Técnica
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">
                Fichas Técnicas Existentes
              </h3>

              {isLoadingFichas ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Cargando fichas...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Permisos</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fichas.map((ficha) => (
                      <TableRow key={ficha.key}>
                        <TableCell className="font-medium">
                          {ficha.name}
                        </TableCell>
                        <TableCell>{formatFileSize(ficha.size)}</TableCell>
                        <TableCell>
                          {new Date(ficha.lastModified).toLocaleDateString(
                            "es-ES"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              getPermisoLabel(ficha.allowedRoles) ===
                              "Todos los usuarios"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {getPermisoLabel(ficha.allowedRoles)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => {
                              setFichaToDelete(ficha);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={deletingId === ficha.key}
                            variant="destructive"
                            size="sm"
                          >
                            {deletingId === ficha.key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar ficha técnica?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La ficha técnica &ldquo;
                {fichaToDelete?.name}&rdquo; será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setFichaToDelete(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteFicha}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default FichasTecnicasDialog;
