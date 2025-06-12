"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Papa from "papaparse";

import { XCircleIcon, Plus, Loader2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { InventoryCard } from "@/components/inventory-dashboard/InventoryCard";
import { VisualizationsCard } from "@/components/inventory-dashboard/VisualizationsCard";
import { UserManagementCard } from "@/components/inventory-dashboard/UserManagementCard";
import { KeyMetricsSection } from "@/components/inventory-dashboard/KeyMetricsSection";
import { PendingFabricsCard } from "@/components/inventory-dashboard/PendingFabricsCard";
import { NewOrderDialog } from "@/components/inventory-dashboard/NewOrderDialog";
import { NewUserDialog } from "@/components/inventory-dashboard/NewUserDialog";
import { InventoryHistoryDialog } from "@/components/inventory-dashboard/InventoryHistoryDialog";
import FichasTecnicasDialog from "@/components/fichas-tecnicas/FichasTecnicasDialog";
import LockScreen from "@/components/inventory-dashboard/LockScreen";
import {
  InventoryItem,
  UnitType,
  User,
  ParsedCSVData,
  FilterOptions,
} from "../../../types/types";
import { parseNumericValue, mapCsvFields, normalizeCsvData } from "@/lib/utils";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const mobileQuery = window.matchMedia("(max-width: 1024px)");
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

interface NewRowDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormData {
  OC: string;
  Tela: string;
  Color: string;
  Ubicacion: string;
  Cantidad: string;
  Costo: string;
  Unidades: "KGS" | "MTS";
  Importacion: string;
  FacturaDragonAzteca: string;
}

const NewRowDialog: React.FC<NewRowDialogProps> = ({
  open,
  setOpen,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    OC: "",
    Tela: "",
    Color: "",
    Ubicacion: "",
    Cantidad: "",
    Costo: "",
    Unidades: "KGS",
    Importacion: "",
    FacturaDragonAzteca: "",
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): boolean => {
    const requiredFields = [
      "OC",
      "Tela",
      "Color",
      "Ubicacion",
      "Cantidad",
      "Costo",
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]?.trim()) {
        toast.error(`El campo ${field} es requerido`);
        return false;
      }
    }

    const cantidad = parseFloat(formData.Cantidad);
    const costo = parseFloat(formData.Costo);

    if (isNaN(cantidad) || cantidad <= 0) {
      toast.error("La cantidad debe ser un número mayor a 0");
      return false;
    }

    if (isNaN(costo) || costo < 0) {
      toast.error("El costo debe ser un número mayor o igual a 0");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    const submitStartTime = Date.now();

    try {
      console.log("🚀 [NEW-ROW] === CREANDO NUEVA ROW ===");
      console.log("📋 [NEW-ROW] Datos a enviar:", formData);
      console.log("⏰ [NEW-ROW] Timestamp inicio:", new Date().toISOString());

      const requestBody = {
        ...formData,
        Cantidad: parseFloat(formData.Cantidad),
        Costo: parseFloat(formData.Costo),
      };

      console.log("📦 [NEW-ROW] Body de la request:", requestBody);

      const response = await fetch("/api/s3/inventario/create-row", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const submitDuration = Date.now() - submitStartTime;
      console.log(`⏱️ [NEW-ROW] Request completada en ${submitDuration}ms`);

      const result = await response.json();
      console.log("📊 [NEW-ROW] Respuesta completa:", result);

      if (!response.ok) {
        console.error(
          "❌ [NEW-ROW] Error en respuesta:",
          response.status,
          response.statusText
        );
        throw new Error(result.error || "Error al crear la nueva row");
      }

      console.log("✅ [NEW-ROW] Row creada exitosamente:");
      console.log("📄 [NEW-ROW] Archivo creado:", result.data.fileKey);
      console.log("📊 [NEW-ROW] Item creado:", result.data.item);

      toast.success(`🎉 Nueva row creada exitosamente`, {
        description: `${result.data.fileName} - ${result.data.item.OC} ${result.data.item.Tela} ${result.data.item.Color}`,
      });

      setFormData({
        OC: "",
        Tela: "",
        Color: "",
        Ubicacion: "",
        Cantidad: "",
        Costo: "",
        Unidades: "KGS",
        Importacion: "",
        FacturaDragonAzteca: "",
      });

      setOpen(false);

      console.log("🔄 [NEW-ROW] Llamando callback de éxito...");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const submitDuration = Date.now() - submitStartTime;
      console.error(
        `❌ [NEW-ROW] Error después de ${submitDuration}ms:`,
        error
      );
      toast.error(
        error instanceof Error ? error.message : "Error al crear la nueva row"
      );
    } finally {
      setIsLoading(false);
      console.log("🏁 [NEW-ROW] === PROCESO COMPLETADO ===");
    }
  };

  const handleCancel = () => {
    console.log("❌ [NEW-ROW] Usuario canceló la creación");
    setOpen(false);
    setFormData({
      OC: "",
      Tela: "",
      Color: "",
      Ubicacion: "",
      Cantidad: "",
      Costo: "",
      Unidades: "KGS",
      Importacion: "",
      FacturaDragonAzteca: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Agregar Nueva Row de Inventario
          </DialogTitle>
          <DialogDescription>
            Crea una nueva entrada de inventario con status &quot;success&quot;.
            Todos los campos marcados con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="oc" className="text-right">
              OC *
            </Label>
            <Input
              id="oc"
              placeholder="Ej: Dsma-03-23-Slm1-Pqp1"
              value={formData.OC}
              onChange={(e) => handleInputChange("OC", e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tela" className="text-right">
              Tela *
            </Label>
            <Input
              id="tela"
              placeholder="Ej: Slim, Maiky Plus, etc."
              value={formData.Tela}
              onChange={(e) => handleInputChange("Tela", e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">
              Color *
            </Label>
            <Input
              id="color"
              placeholder="Ej: Rojo, Negro, Azul, etc."
              value={formData.Color}
              onChange={(e) => handleInputChange("Color", e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ubicacion" className="text-right">
              Ubicación *
            </Label>
            <Select
              value={formData.Ubicacion}
              onValueChange={(value) => handleInputChange("Ubicacion", value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecciona ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CDMX">CDMX</SelectItem>
                <SelectItem value="Mérida">Mérida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cantidad" className="text-right">
              Cantidad *
            </Label>
            <Input
              id="cantidad"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Ej: 100.5"
              value={formData.Cantidad}
              onChange={(e) => handleInputChange("Cantidad", e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="costo" className="text-right">
              Costo *
            </Label>
            <Input
              id="costo"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 77.50"
              value={formData.Costo}
              onChange={(e) => handleInputChange("Costo", e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unidades" className="text-right">
              Unidades *
            </Label>
            <Select
              value={formData.Unidades}
              onValueChange={(value: "KGS" | "MTS") =>
                handleInputChange("Unidades", value)
              }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KGS">KGS</SelectItem>
                <SelectItem value="MTS">MTS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="importacion" className="text-right">
              Importación
            </Label>
            <Select
              value={formData.Importacion}
              onValueChange={(value) => handleInputChange("Importacion", value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DA">DA</SelectItem>
                <SelectItem value="HOY">HOY</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="factura" className="text-right">
              Factura D.A.
            </Label>
            <Input
              id="factura"
              placeholder="Número de factura (opcional)"
              value={formData.FacturaDragonAzteca}
              onChange={(e) =>
                handleInputChange("FacturaDragonAzteca", e.target.value)
              }
              className="col-span-3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Crear Row
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function processInventoryData(
  data: Record<string, unknown>[]
): InventoryItem[] {
  const processedItems: InventoryItem[] = [];

  data.forEach((item: Record<string, unknown>) => {
    const safeStringValue = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === "string") return value;
      return String(value);
    };

    const safeNumericValue = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string") return value;
      return String(value);
    };

    const costo = parseNumericValue(safeNumericValue(item.Costo));
    const cantidad = parseNumericValue(safeNumericValue(item.Cantidad));

    const normalizeImportacion = (value: unknown): "DA" | "HOY" | "-" | "" => {
      if (value === null || value === undefined) return "-";

      const normalized = value.toString().toLowerCase().trim();
      if (normalized === "hoy") return "HOY";
      if (normalized === "da") return "DA";
      if (normalized === "nan" || normalized === "") return "-";

      return "";
    };

    let ubicacion = "";
    let cantidadFinal = cantidad;

    if (item.almacen) {
      ubicacion = item.almacen === "CDMX" ? "CDMX" : "Mérida";
    } else if (item.CDMX !== undefined && item.MID !== undefined) {
      const cantidadCDMX = parseNumericValue(safeNumericValue(item.CDMX));
      const cantidadMID = parseNumericValue(safeNumericValue(item.MID));

      if (cantidadCDMX > 0 && cantidadMID > 0) {
        const baseItem = {
          OC: safeStringValue(item.OC),
          Tela: safeStringValue(item.Tela),
          Color: safeStringValue(item.Color),
          Costo: costo,
          Unidades: (item.Unidades || "").toString().toUpperCase() as UnitType,
          Importacion: normalizeImportacion(item.Importación || ""),
          FacturaDragonAzteca: safeStringValue(
            item["Factura Dragón Azteca"] ||
              item["Factura Dragon Azteca"] ||
              item.FacturaDragonAzteca ||
              ""
          ),
        };

        processedItems.push({
          ...baseItem,
          Cantidad: cantidadCDMX,
          Total: costo * cantidadCDMX,
          Ubicacion: "CDMX",
        });

        processedItems.push({
          ...baseItem,
          Cantidad: cantidadMID,
          Total: costo * cantidadMID,
          Ubicacion: "Mérida",
        });

        return;
      } else if (cantidadCDMX > 0) {
        ubicacion = "CDMX";
        cantidadFinal = cantidadCDMX;
      } else if (cantidadMID > 0) {
        ubicacion = "Mérida";
        cantidadFinal = cantidadMID;
      } else {
        ubicacion = safeStringValue(item.Ubicacion);
      }
    } else {
      ubicacion = safeStringValue(item.Ubicacion);

      if (!ubicacion) {
        const oc = safeStringValue(item.OC).toLowerCase();

        if (
          oc.includes("ttl-04-25") ||
          oc.includes("ttl-02-2025") ||
          oc.includes("dr-05-25")
        ) {
          ubicacion = "CDMX";
        } else if (oc.includes("dsma-03-23") || oc.includes("dsma-04-23")) {
          ubicacion = "Mérida";
        } else {
          ubicacion = "CDMX";
        }
      }
    }

    const finalItem = {
      OC: safeStringValue(item.OC),
      Tela: safeStringValue(item.Tela),
      Color: safeStringValue(item.Color),
      Costo: costo,
      Cantidad: cantidadFinal,
      Unidades: (item.Unidades || "").toString().toUpperCase() as UnitType,
      Total: costo * cantidadFinal,
      Ubicacion: ubicacion,
      Importacion: normalizeImportacion(item.Importación || ""),
      FacturaDragonAzteca: safeStringValue(
        item["Factura Dragón Azteca"] ||
          item["Factura Dragon Azteca"] ||
          item.FacturaDragonAzteca ||
          ""
      ),
    };

    processedItems.push(finalItem);
  });

  return processedItems;
}

const Dashboard = () => {
  const isMobile = useIsMobile();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState<UnitType | "all">("all");
  const [ocFilter, setOcFilter] = useState<string>("all");
  const [telaFilter, setTelaFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [ubicacionFilter, setUbicacionFilter] = useState<string>("all");
  const [error, setError] = useState("");
  const [openNewOrder, setOpenNewOrder] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [openNewRow, setOpenNewRow] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [openFichasTecnicas, setOpenFichasTecnicas] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [openNewUser, setOpenNewUser] = useState(false);

  const inventoryLoadedRef = useRef(false);

  const { data: session } = useSession();

  const handleInventoryLoadingChange = (isLoading: boolean) => {
    setIsLoadingInventory(isLoading);
  };

  const setSuccess = (message: string | ((prev: string) => string)) => {
    const messageText = typeof message === "function" ? message("") : message;
    if (messageText) {
      toast.success(messageText);
    }
  };

  const isAdmin =
    session?.user?.role === "admin" || session?.user?.role === "major_admin";
  const isMajorAdmin = session?.user?.role === "major_admin";

  const filters: FilterOptions = {
    searchTerm,
    unitFilter,
    ocFilter,
    telaFilter,
    colorFilter,
    ubicacionFilter,
  };

  function getMonthName(monthNumber: string): string {
    const months = [
      { value: "01", label: "Enero" },
      { value: "02", label: "Febrero" },
      { value: "03", label: "Marzo" },
      { value: "04", label: "Abril" },
      { value: "05", label: "Mayo" },
      { value: "06", label: "Junio" },
      { value: "07", label: "Julio" },
      { value: "08", label: "Agosto" },
      { value: "09", label: "Septiembre" },
      { value: "10", label: "Octubre" },
      { value: "11", label: "Noviembre" },
      { value: "12", label: "Diciembre" },
    ];
    const month = months.find((m) => m.value === monthNumber);
    return month ? month.label : "";
  }

  const handleNewRowSuccess = () => {
    console.log(
      "🔄 [RELOAD-INVENTORY] === RECARGANDO INVENTARIO POST-CREACIÓN ==="
    );

    if (!session?.user) {
      console.error("❌ [RELOAD-INVENTORY] No hay sesión de usuario");
      return;
    }

    inventoryLoadedRef.current = false;
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");
    const apiUrl = `/api/s3/inventario?year=${currentYear}&month=${currentMonth}`;

    console.log(`📞 [RELOAD-INVENTORY] Llamando a: ${apiUrl}`);
    console.log(`⏰ [RELOAD-INVENTORY] Timestamp: ${new Date().toISOString()}`);

    const reloadStartTime = Date.now();

    fetch(apiUrl)
      .then((response) => {
        const reloadDuration = Date.now() - reloadStartTime;
        console.log(
          `📨 [RELOAD-INVENTORY] Respuesta recibida en ${reloadDuration}ms:`,
          {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          }
        );
        return response.json();
      })
      .then((jsonData) => {
        const totalDuration = Date.now() - reloadStartTime;
        console.log(
          `📊 [RELOAD-INVENTORY] Datos procesados en ${totalDuration}ms:`,
          {
            hasData: !!jsonData.data,
            isArray: Array.isArray(jsonData.data),
            itemCount: jsonData.data?.length || 0,
            error: jsonData.error,
          }
        );

        if (jsonData.data && Array.isArray(jsonData.data)) {
          console.log(
            "🔄 [RELOAD-INVENTORY] Procesando datos con processInventoryData..."
          );
          const parsedData = processInventoryData(jsonData.data);

          console.log(
            `✅ [RELOAD-INVENTORY] Inventario actualizado: ${parsedData.length} items`
          );
          setInventory(parsedData);
          toast.success("✅ Inventario actualizado con nueva row");
        } else {
          console.error(
            "❌ [RELOAD-INVENTORY] Formato de datos inválido:",
            jsonData
          );
          toast.error(
            "Error: Formato de datos inválido al recargar inventario"
          );
        }
      })
      .catch((error) => {
        const totalDuration = Date.now() - reloadStartTime;
        console.error(
          `❌ [RELOAD-INVENTORY] Error después de ${totalDuration}ms:`,
          error
        );
        toast.error("Error recargando inventario después de crear row");
      })
      .finally(() => {
        console.log(
          "🏁 [RELOAD-INVENTORY] === PROCESO DE RECARGA COMPLETADO ==="
        );
      });
  };

  useEffect(() => {
    async function loadInventoryFromAPI() {
      if (!session?.user || inventoryLoadedRef.current) return;

      try {
        setIsLoadingInventory(true);

        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");

        const response = await fetch(
          `/api/s3/inventario?year=${currentYear}&month=${currentMonth}`
        );

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

        const parsedData = processInventoryData(jsonData.data);

        setInventory(parsedData);
        inventoryLoadedRef.current = true;
      } catch (error) {
        console.error("Error loading inventory from API:", error);
        if (!isMobile) {
          toast.error(
            "Error al cargar el inventario desde S3. Verifica la conexión."
          );
        }
        setError(
          "Error al cargar el inventario desde S3. Verifica la conexión."
        );
      } finally {
        setIsLoadingInventory(false);
      }
    }

    loadInventoryFromAPI();

    return () => {};
  }, [session?.user, isMobile]);

  const handleLoadHistoricalInventory = async (year: string, month: string) => {
    try {
      setIsLoadingInventory(true);
      toast.info(`Cargando inventario de ${getMonthName(month)} ${year}...`);

      const response = await fetch(
        `/api/s3/inventario?year=${year}&month=${month}`
      );

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

      const parsedData = processInventoryData(jsonData.data);

      setInventory(parsedData);
      toast.success(
        `Inventario de ${getMonthName(month)} ${year} cargado exitosamente`
      );
    } catch (error) {
      console.error("Error loading historical inventory:", error);
      toast.error(
        `Error al cargar el inventario de ${getMonthName(
          month
        )} ${year}. Es posible que no exista.`
      );
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    async function loadUsers() {
      if (!isAdmin) {
        setIsLoadingUsers(false);
        return;
      }

      try {
        setIsLoadingUsers(true);
        const response = await fetch("/api/users");

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al cargar usuarios");
        }

        const data = await response.json();
        setUsers(data.users);
      } catch (error) {
        console.error("Error cargando usuarios:", error);
        toast.error("No se pudieron cargar los usuarios");
      } finally {
        setIsLoadingUsers(false);
      }
    }

    loadUsers();
  }, [isAdmin]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<ParsedCSVData>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: ",",
      delimitersToGuess: [",", ";", "\t", "|"],

      transform: (value, field) => {
        if (field === "Costo" || field === "Cantidad") {
          return value.replace(/\s/g, "").replace(/\$/g, "").replace(/,/g, ".");
        }
        return value;
      },

      complete: (results: Papa.ParseResult<ParsedCSVData>) => {
        try {
          const fieldMap = mapCsvFields(results.meta.fields || []);

          let dataToProcess: Record<string, unknown>[] = results.data;
          if (
            Object.keys(fieldMap).length > 0 &&
            Object.keys(fieldMap).length !== results.meta.fields?.length
          ) {
            dataToProcess = normalizeCsvData(results.data, fieldMap);
          }

          const parsedData = processInventoryData(dataToProcess);

          setInventory(parsedData);
          toast.success("Archivo cargado exitosamente");
        } catch (err) {
          console.error("Error parsing CSV:", err);
          toast.error(
            "Error al procesar el archivo CSV. Verifique el formato."
          );
        }
      },
      error: (error: Error) => {
        console.error("CSV parsing error:", error);
        toast.error("Error al leer el archivo CSV");
      },
    });
  };

  if (isMobile) {
    return (
      <div className="fixed inset-0 overflow-hidden">
        <div className="h-full flex flex-col items-center justify-center p-4">
          {/* Contenedor para botón + LockScreen centrados */}
          <div className="w-full space-y-4">
            {/* Botón de Fichas Técnicas con padding igual al LockScreen */}
            <div className="max-w-lg mx-auto px-4">
              <Button
                onClick={() => setOpenFichasTecnicas(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center justify-center gap-2 h-11"
              >
                <FileText className="h-4 w-4" />
                Fichas Técnicas
              </Button>
            </div>

            {/* LockScreen */}
            <div>
              <LockScreen
                inventory={inventory}
                filters={filters}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoadingInventory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 mx-4 max-w-sm w-full shadow-xl">
              <div className="flex items-center space-x-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Procesando información
                  </h3>
                  <p className="text-sm text-gray-600">
                    Cargando inventario desde S3...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <FichasTecnicasDialog
          open={openFichasTecnicas}
          setOpen={setOpenFichasTecnicas}
        />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4 relative">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            onClick={() => setError("")}
          >
            <XCircleIcon className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </Button>
        </Alert>
      )}

      {isAdmin && <KeyMetricsSection inventory={inventory} filters={filters} />}

      <PendingFabricsCard setInventory={setInventory} isAdmin={isAdmin} />

      <InventoryCard
        inventory={inventory}
        setInventory={setInventory}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        unitFilter={unitFilter}
        setUnitFilter={setUnitFilter}
        ocFilter={ocFilter}
        setOcFilter={setOcFilter}
        telaFilter={telaFilter}
        setTelaFilter={setTelaFilter}
        colorFilter={colorFilter}
        setColorFilter={setColorFilter}
        ubicacionFilter={ubicacionFilter}
        setUbicacionFilter={setUbicacionFilter}
        setSuccess={setSuccess}
        handleFileUpload={handleFileUpload}
        openNewOrder={openNewOrder}
        isAdmin={isAdmin}
        isLoading={isLoadingInventory}
        onLoadingChange={handleInventoryLoadingChange}
      />

      {isAdmin && (
        <VisualizationsCard inventory={inventory} filters={filters} />
      )}

      {isAdmin && (
        <UserManagementCard
          users={users}
          setUsers={setUsers}
          isLoadingUsers={isLoadingUsers}
          setOpenNewUser={setOpenNewUser}
        />
      )}

      <NewOrderDialog
        open={openNewOrder}
        setOpen={setOpenNewOrder}
        setInventory={setInventory}
        setSuccess={setSuccess}
      />

      {isAdmin && (
        <NewUserDialog
          open={openNewUser}
          setOpen={setOpenNewUser}
          users={users}
          setUsers={setUsers}
          session={session}
        />
      )}

      {isMajorAdmin && (
        <InventoryHistoryDialog
          open={openHistoryDialog}
          setOpen={setOpenHistoryDialog}
          onLoadInventory={handleLoadHistoricalInventory}
        />
      )}

      {isAdmin && (
        <NewRowDialog
          open={openNewRow}
          setOpen={setOpenNewRow}
          onSuccess={handleNewRowSuccess}
        />
      )}

      <FichasTecnicasDialog
        open={openFichasTecnicas}
        setOpen={setOpenFichasTecnicas}
      />
    </div>
  );
};

export default Dashboard;

export { processInventoryData };

export {};
