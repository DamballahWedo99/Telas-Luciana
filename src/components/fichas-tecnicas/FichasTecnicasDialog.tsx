"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Plus,
  Search,
  Edit,
  Eye,
  X,
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  _optimistic?: boolean;
}

interface UploadFormData {
  fileName: string;
  archivo: File | null;
  tipoPermiso: "admin" | "todos";
}

function removePointerEventsFromBody() {
  if (typeof document !== "undefined") {
    if (document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
    if (document.body.getAttribute("style")?.includes("pointer-events: none")) {
      const currentStyle = document.body.getAttribute("style") || "";
      const newStyle = currentStyle
        .replace(/pointer-events:\s*none;?/gi, "")
        .trim();
      if (newStyle) {
        document.body.setAttribute("style", newStyle);
      } else {
        document.body.removeAttribute("style");
      }
    }
  }
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
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [fichaToEdit, setFichaToEdit] = useState<FichaTecnica | null>(null);
  const [editingId, setEditingId] = useState<string>("");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [fichaToPreview, setFichaToPreview] = useState<FichaTecnica | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const [uploadForm, setUploadForm] = useState<UploadFormData>({
    fileName: "",
    archivo: null,
    tipoPermiso: "admin",
  });

  const [editForm, setEditForm] = useState({
    fileName: "",
    tipoPermiso: "admin" as "admin" | "todos",
  });

  const userRole = session?.user?.role;
  const isSeller = userRole === "seller";
  const isAdmin = userRole === "admin" || userRole === "major_admin";

  const generateOptimisticKey = (fileName: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedFileName = fileName
      .replace(/\s+/g, "_")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    return `Inventario/Fichas Tecnicas/optimistic_${sanitizedFileName}_${timestamp}.pdf`;
  };

  const addFichaOptimistic = (uploadData: UploadFormData): FichaTecnica => {
    const allowedRoles =
      uploadData.tipoPermiso === "admin"
        ? ["major_admin", "admin"]
        : ["major_admin", "admin", "seller"];

    const optimisticFicha: FichaTecnica = {
      key: generateOptimisticKey(uploadData.fileName),
      name: uploadData.fileName,
      size: uploadData.archivo?.size || 0,
      lastModified: new Date().toISOString(),
      allowedRoles,
      _optimistic: true,
    };

    setFichas((prev) => [optimisticFicha, ...prev]);
    return optimisticFicha;
  };

  const updateFichaOptimistic = (
    oldFicha: FichaTecnica,
    newData: { fileName: string; tipoPermiso: "admin" | "todos" }
  ): void => {
    const allowedRoles =
      newData.tipoPermiso === "admin"
        ? ["major_admin", "admin"]
        : ["major_admin", "admin", "seller"];

    setFichas((prev) =>
      prev.map((ficha) =>
        ficha.key === oldFicha.key
          ? {
              ...ficha,
              name: newData.fileName,
              allowedRoles,
              _optimistic: true,
            }
          : ficha
      )
    );
  };

  const removeFichaOptimistic = (fichaToRemove: FichaTecnica): void => {
    setFichas((prev) =>
      prev.filter((ficha) => ficha.key !== fichaToRemove.key)
    );
  };

  const revertOptimisticChange = (originalFichas: FichaTecnica[]): void => {
    setFichas(originalFichas);
  };

  const replaceOptimisticFicha = (
    optimisticKey: string,
    realFicha: FichaTecnica
  ): void => {
    setFichas((prev) =>
      prev.map((ficha) => (ficha.key === optimisticKey ? realFicha : ficha))
    );
  };

  const filteredFichas = useMemo(() => {
    if (!searchQuery.trim()) return fichas;

    const query = searchQuery.toLowerCase();
    return fichas.filter((ficha) => ficha.name.toLowerCase().includes(query));
  }, [fichas, searchQuery]);

  const adminFilteredFichas = useMemo(() => {
    if (!adminSearchQuery.trim()) return fichas;

    const query = adminSearchQuery.toLowerCase();
    return fichas.filter((ficha) => ficha.name.toLowerCase().includes(query));
  }, [fichas, adminSearchQuery]);

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
    const originalFichas = [...fichas];

    try {
      removeFichaOptimistic(fichaToDelete);
      setDeleteDialogOpen(false);

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
      setFichaToDelete(null);

      setTimeout(() => {
        removePointerEventsFromBody();
      }, 100);
    } catch (error) {
      console.error("Error deleting ficha técnica:", error);

      revertOptimisticChange(originalFichas);
      setDeleteDialogOpen(true);

      toast.error(
        error instanceof Error
          ? error.message
          : "Error al eliminar la ficha técnica"
      );
    } finally {
      setDeletingId("");
    }
  };

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setFichaToDelete(null);

    setTimeout(() => {
      removePointerEventsFromBody();
    }, 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditDialogOpen(false);
    setFichaToEdit(null);
    setEditForm({ fileName: "", tipoPermiso: "admin" });

    setTimeout(() => {
      removePointerEventsFromBody();
    }, 50);
  }, []);

  const handleCancelPreview = useCallback(() => {
    setPreviewDialogOpen(false);
    setFichaToPreview(null);
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }

    setTimeout(() => {
      removePointerEventsFromBody();
    }, 50);
  }, [previewUrl]);

  const handleEditFicha = (ficha: FichaTecnica) => {
    setFichaToEdit(ficha);
    setEditForm({
      fileName: ficha.name,
      tipoPermiso: ficha.allowedRoles.includes("seller") ? "todos" : "admin",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!fichaToEdit || !editForm.fileName.trim()) {
      toast.error("El nombre de la ficha es requerido");
      return;
    }

    setEditingId(fichaToEdit.key);
    const originalFichas = [...fichas];

    try {
      updateFichaOptimistic(fichaToEdit, editForm);

      const allowedRoles =
        editForm.tipoPermiso === "admin"
          ? ["major_admin", "admin"]
          : ["major_admin", "admin", "seller"];

      const response = await fetch("/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: fichaToEdit.key,
          newFileName: editForm.fileName,
          allowedRoles: allowedRoles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al editar la ficha técnica");
      }

      const responseData = await response.json();

      if (responseData.newKey && responseData.newKey !== fichaToEdit.key) {
        setFichas((prev) =>
          prev.map((ficha) =>
            ficha.key === fichaToEdit.key
              ? { ...ficha, key: responseData.newKey, _optimistic: false }
              : ficha
          )
        );
      } else {
        setFichas((prev) =>
          prev.map((ficha) =>
            ficha.key === fichaToEdit.key
              ? { ...ficha, _optimistic: false }
              : ficha
          )
        );
      }

      toast.success("Ficha técnica editada exitosamente");
      setEditDialogOpen(false);
      setFichaToEdit(null);
      setEditForm({ fileName: "", tipoPermiso: "admin" });

      setTimeout(() => {
        removePointerEventsFromBody();
      }, 100);
    } catch (error) {
      console.error("Error editing ficha técnica:", error);

      revertOptimisticChange(originalFichas);

      toast.error(
        error instanceof Error
          ? error.message
          : "Error al editar la ficha técnica"
      );
    } finally {
      setEditingId("");
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
    let optimisticFicha: FichaTecnica | null = null;

    try {
      optimisticFicha = addFichaOptimistic(uploadForm);

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

      const responseData = await response.json();

      if (optimisticFicha && responseData.key) {
        const realFicha: FichaTecnica = {
          key: responseData.key,
          name: responseData.fileName || uploadForm.fileName,
          size: uploadForm.archivo.size,
          lastModified: new Date().toISOString(),
          allowedRoles,
        };
        replaceOptimisticFicha(optimisticFicha.key, realFicha);
      }

      toast.success("Ficha técnica subida exitosamente");

      setUploadForm({
        fileName: "",
        archivo: null,
        tipoPermiso: "admin",
      });

      setShowUploadForm(false);
    } catch (error) {
      console.error("Error uploading ficha técnica:", error);

      if (optimisticFicha) {
        removeFichaOptimistic(optimisticFicha);
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Error al subir la ficha técnica"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async (ficha: FichaTecnica) => {
    if (ficha._optimistic) {
      toast.error("Espera a que se complete la subida del archivo");
      return;
    }

    setFichaToPreview(ficha);
    setPreviewLoading(true);
    setPreviewDialogOpen(true);

    try {
      const response = await fetch(
        `/api/s3/fichas-tecnicas/download?key=${encodeURIComponent(ficha.key)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Error al cargar la vista previa"
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cargar la vista previa"
      );
      setPreviewDialogOpen(false);
      setFichaToPreview(null);
    } finally {
      setPreviewLoading(false);
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
    setShowUploadForm(false);
    setSearchQuery("");
    setAdminSearchQuery("");
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
  }) => {
    const isOptimistic = ficha._optimistic;

    return (
      <div
        className={`group relative bg-white border border-gray-200 rounded-2xl p-6 shadow-sm ${isOptimistic ? "opacity-75 border-dashed border-blue-300" : ""}`}
      >
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0"></div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-gray-900 text-sm leading-5 line-clamp-2">
                {ficha.name}
              </h3>
              {isOptimistic && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
            </div>

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

            <div className={`${showAdminControls ? "flex space-x-2" : "flex flex-col space-y-2"}`}>
              <div className={`${showAdminControls ? "flex space-x-2 flex-1" : "flex space-x-2"}`}>
                <Button
                  onClick={() => handlePreview(ficha)}
                  disabled={isOptimistic}
                  className={`${
                    showAdminControls ? "flex-1" : "flex-1"
                  } bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl h-10 text-sm font-medium shadow-sm`}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Vista previa
                </Button>
                <Button
                  onClick={() => handleDownload(ficha.key)}
                  disabled={downloadingId === ficha.key || isOptimistic}
                  className={`${
                    showAdminControls ? "flex-1" : "flex-1"
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
              </div>

              {showAdminControls && (
                <>
                  <Button
                    onClick={() => handleEditFicha(ficha)}
                    disabled={editingId === ficha.key || isOptimistic}
                    variant="outline"
                    size="icon"
                    className="rounded-xl h-10 w-10"
                  >
                    {editingId === ficha.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Edit className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setFichaToDelete(ficha);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={deletingId === ficha.key || isOptimistic}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isSeller && isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-hidden p-0 rounded-3xl [&>button]:hidden">
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-blue-100 rounded-2xl">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              Fichas Técnicas
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm">
              Busca y descarga fichas técnicas
            </DialogDescription>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar fichas técnicas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300"
                />
              </div>
            </div>

            {isLoadingFichas ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-4 bg-blue-50 rounded-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <p className="text-gray-600 font-medium">
                  Cargando fichas técnicas...
                </p>
              </div>
            ) : filteredFichas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    {searchQuery
                      ? "No se encontraron fichas"
                      : "No hay fichas disponibles"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {searchQuery
                      ? `No hay fichas que coincidan con "${searchQuery}"`
                      : "No hay fichas técnicas disponibles para tu rol."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {filteredFichas.map((ficha) => (
                  <FichaCard key={ficha.key} ficha={ficha} />
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 rounded-b-3xl flex-shrink-0">
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

  if (isAdmin && isMobile) {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden p-0 rounded-3xl [&>button]:hidden">
            <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-blue-100 rounded-2xl">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                Fichas Técnicas
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm">
                Gestiona y descarga fichas técnicas
              </DialogDescription>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {!showUploadForm && (
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar fichas técnicas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 rounded-xl h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300"
                    />
                  </div>
                </div>
              )}

              {showUploadForm && (
                <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Subir Nueva Ficha
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="nombre" className="text-sm font-medium">
                        Nombre del Archivo
                      </Label>
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
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="archivo" className="text-sm font-medium">
                        Archivo PDF
                      </Label>
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
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Permisos</Label>
                      <Select
                        value={uploadForm.tipoPermiso}
                        onValueChange={(value: "admin" | "todos") =>
                          setUploadForm((prev) => ({
                            ...prev,
                            tipoPermiso: value,
                          }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            Solo administradores
                          </SelectItem>
                          <SelectItem value="todos">
                            Todos los usuarios
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {!showUploadForm && (
                <>
                  {isLoadingFichas ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="p-4 bg-blue-50 rounded-full">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      </div>
                      <p className="text-gray-600 font-medium">
                        Cargando fichas técnicas...
                      </p>
                    </div>
                  ) : filteredFichas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="text-center space-y-2">
                        <h3 className="font-semibold text-gray-900">
                          {searchQuery
                            ? "No se encontraron fichas"
                            : "No hay fichas disponibles"}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {searchQuery
                            ? `No hay fichas que coincidan con "${searchQuery}"`
                            : "Aún no hay fichas técnicas subidas."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredFichas.map((ficha) => (
                        <FichaCard
                          key={ficha.key}
                          ficha={ficha}
                          showAdminControls={true}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-3xl flex-shrink-0">
              <div className="flex space-x-2">
                {showUploadForm ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowUploadForm(false)}
                      className="flex-1 h-12 font-medium rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={isLoading}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl h-12 text-sm font-medium shadow-sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      className="flex-1 h-12 font-medium rounded-xl"
                    >
                      Cerrar
                    </Button>
                    <Button
                      onClick={() => setShowUploadForm(true)}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl h-12 text-sm font-medium shadow-sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva ficha
                    </Button>
                  </>
                )}
              </div>
            </div>

            <style jsx>{`
              .line-clamp-2 {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }
            `}</style>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              handleCancelDelete();
            }
          }}
        >
          <AlertDialogContent className="max-w-[90vw] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar ficha técnica?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La ficha técnica &ldquo;
                {fichaToDelete?.name}&rdquo; será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <AlertDialogCancel
                onClick={(e) => {
                  e.preventDefault();
                  handleCancelDelete();
                }}
                className="w-full sm:w-auto"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteFicha}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              handleCancelEdit();
            }
          }}
        >
          <AlertDialogContent className="max-w-[90vw] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Editar ficha técnica</AlertDialogTitle>
              <AlertDialogDescription>
                Modifica el nombre y permisos de la ficha técnica &ldquo;
                {fichaToEdit?.name}&rdquo;.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label
                  htmlFor="edit-nombre-mobile"
                  className="text-sm font-medium"
                >
                  Nombre del Archivo *
                </Label>
                <Input
                  id="edit-nombre-mobile"
                  placeholder="Ej: Manual_Operacion_Maquina_X"
                  value={editForm.fileName}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      fileName: e.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Permisos de Visualización *
                </Label>
                <Select
                  value={editForm.tipoPermiso}
                  onValueChange={(value: "admin" | "todos") =>
                    setEditForm((prev) => ({
                      ...prev,
                      tipoPermiso: value,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Solo administradores</SelectItem>
                    <SelectItem value="todos">Todos los usuarios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <AlertDialogCancel
                onClick={(e) => {
                  e.preventDefault();
                  handleCancelEdit();
                }}
                className="w-full sm:w-auto"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSaveEdit}
                disabled={editingId !== ""}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                {editingId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
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
              Busca y descarga fichas técnicas disponibles para tu rol.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar fichas técnicas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300"
              />
            </div>

            {isLoadingFichas ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="p-4 bg-blue-50 rounded-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <p className="text-gray-600 font-medium">
                  Cargando fichas técnicas...
                </p>
              </div>
            ) : filteredFichas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    {searchQuery
                      ? "No se encontraron fichas"
                      : "No hay fichas disponibles"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {searchQuery
                      ? `No hay fichas que coincidan con "${searchQuery}"`
                      : "No hay fichas técnicas disponibles para tu rol."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto p-1">
                {filteredFichas.map((ficha) => (
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Fichas Técnicas
            </DialogTitle>
            <DialogDescription>
              Busca, gestiona y descarga fichas técnicas según tu rol de
              usuario.
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar fichas técnicas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300"
                />
              </div>

              {isLoadingFichas ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="p-4 bg-blue-50 rounded-full">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                  <p className="text-gray-600 font-medium">
                    Cargando fichas técnicas...
                  </p>
                </div>
              ) : filteredFichas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-gray-900">
                      {searchQuery
                        ? "No se encontraron fichas"
                        : "No hay fichas disponibles"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {searchQuery
                        ? `No hay fichas que coincidan con "${searchQuery}"`
                        : "No hay fichas técnicas disponibles."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto p-1">
                  {filteredFichas.map((ficha) => (
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
                        setUploadForm((prev) => ({
                          ...prev,
                          tipoPermiso: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          Solo administradores
                        </SelectItem>
                        <SelectItem value="todos">
                          Todos los usuarios
                        </SelectItem>
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

                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar en fichas existentes..."
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      className="pl-10 h-10 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300"
                    />
                  </div>
                </div>

                {isLoadingFichas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Cargando fichas...</span>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] w-full rounded-md border">
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
                        {adminFilteredFichas.map((ficha) => {
                          const isOptimistic = ficha._optimistic;

                          return (
                            <TableRow
                              key={ficha.key}
                              className={isOptimistic ? "opacity-75" : ""}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {ficha.name}
                                  {isOptimistic && (
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatFileSize(ficha.size)}
                              </TableCell>
                              <TableCell>
                                {new Date(
                                  ficha.lastModified
                                ).toLocaleDateString("es-ES")}
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
                                <div className="flex space-x-2">
                                  <Button
                                    onClick={() => handlePreview(ficha)}
                                    disabled={isOptimistic}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    onClick={() => handleEditFicha(ficha)}
                                    disabled={
                                      editingId === ficha.key || isOptimistic
                                    }
                                    variant="outline"
                                    size="sm"
                                  >
                                    {editingId === ficha.key ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Edit className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setFichaToDelete(ficha);
                                      setDeleteDialogOpen(true);
                                    }}
                                    disabled={
                                      deletingId === ficha.key || isOptimistic
                                    }
                                    variant="destructive"
                                    size="sm"
                                  >
                                    {deletingId === ficha.key ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            handleCancelDelete();
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ficha técnica?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La ficha técnica &ldquo;
              {fichaToDelete?.name}&rdquo; será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                handleCancelDelete();
              }}
            >
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

      <AlertDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            handleCancelEdit();
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Editar ficha técnica</AlertDialogTitle>
            <AlertDialogDescription>
              Modifica el nombre y permisos de la ficha técnica &ldquo;
              {fichaToEdit?.name}&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-nombre" className="text-sm font-medium">
                Nombre del Archivo *
              </Label>
              <Input
                id="edit-nombre"
                placeholder="Ej: Manual_Operacion_Maquina_X"
                value={editForm.fileName}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    fileName: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">
                Permisos de Visualización *
              </Label>
              <Select
                value={editForm.tipoPermiso}
                onValueChange={(value: "admin" | "todos") =>
                  setEditForm((prev) => ({
                    ...prev,
                    tipoPermiso: value,
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Solo administradores</SelectItem>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                handleCancelEdit();
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveEdit}
              disabled={editingId !== ""}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={previewDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelPreview();
          }
        }}
      >
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-hidden [&>button]:hidden">
          <div className="w-full h-full bg-gray-100 relative">
            {/* Botón flotante para regresar */}
            <Button
              onClick={handleCancelPreview}
              variant="ghost"
              className="absolute bottom-6 right-6 z-50 bg-white/90 hover:bg-white text-gray-800 hover:text-gray-900 rounded-full px-6 py-2 backdrop-blur-sm shadow-lg border border-gray-200"
            >
              <X className="h-4 w-4 mr-2" />
              Regresar
            </Button>
            
            {previewLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-white rounded-full shadow-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                  <p className="text-gray-600 font-medium">
                    Cargando vista previa...
                  </p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Vista previa de ${fichaToPreview?.name}`}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-gray-500">No se pudo cargar la vista previa</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FichasTecnicasDialog;
