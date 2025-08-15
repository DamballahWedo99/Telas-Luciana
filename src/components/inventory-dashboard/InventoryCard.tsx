import React, { useState, useMemo, useEffect, useRef } from "react";
import { newRowSchema, type NewRowFormValues } from "@/lib/zod";
import { z } from "zod";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import {
  ChevronUpIcon,
  ChevronDownIcon,
  DownloadIcon,
  PlusIcon,
  DollarSign,
  Loader2Icon,
  BoxIcon,
  AlertCircle,
  Filter,
  XCircleIcon,
  Search,
  UploadIcon,
  FolderOpenIcon,
  CheckCircle,
  PencilIcon,
  UndoIcon,
  HistoryIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { parseNumericValue, formatNumber } from "@/lib/utils";
import { InventoryItem, UnitType } from "../../../types/types";

interface RawInventoryItem {
  OC?: string | null;
  Tela?: string | null;
  Color?: string | null;
  Ubicacion?: string | null;
  Cantidad?: number | string | null;
  Costo?: number | string | null;
  Unidades?: string | null;
  Importacion?: string | null;
  FacturaDragonAzteca?: string | null;
  status?: string | null;
  almacen?: string | null;
  CDMX?: number | string | null;
  MID?: number | string | null;
  "Factura Dragón Azteca"?: string | null;
  "Factura Dragon Azteca"?: string | null;
  Importación?: string | null;
}

interface ApiSoldRoll {
  roll_number: string;
  fabric_type: string;
  color: string;
  lot: number;
  oc: string;
  almacen: string;
  sold_quantity: number;
  units: string;
  costo: number;
  sold_date: string;
  sale_id: string;
  available_for_return: boolean;
  sale_type: string;
}

interface ReturnRollData {
  roll_number: string;
  fabric_type: string;
  color: string;
  lot: number;
  oc: string;
  almacen: string;
  return_quantity: number;
  units: string;
  costo: number;
  return_reason: string;
  sale_id: string;
  original_sold_date: string;
}

interface PackingListRollData {
  roll_number: number;
  OC: string;
  tela: string;
  color: string;
  lote: string;
  unidad: string;
  cantidad: number;
  fecha_ingreso: string;
  status: string;
  almacen?: string;
  weight?: number;
}

interface ZodError {
  path: (string | number)[];
  message: string;
}

interface SoldRollHistoryData {
  roll_number: string;
  fabric_type: string;
  color: string;
  lot: number;
  oc: string;
  almacen: string;
  sold_quantity: number;
  units: string;
  costo: number;
  sold_date: string;
  sold_by: string;
  available_for_return: boolean;
  sale_type: string;
}

interface InventoryItemData {
  OC: string;
  Tela: string;
  Color: string;
  Ubicacion: string;
  Cantidad: number;
  Costo: number;
  Unidades: string;
  Total?: number;
  Importacion?: string;
  FacturaDragonAzteca?: string;
  status?: string;
}

interface TransferUpdatePayload {
  transferType: "consolidate" | "create";
  oldItem: InventoryItemData;
  existingMeridaItem?: InventoryItemData;
  newItem?: InventoryItemData;
  quantityToTransfer: number;
  newMeridaQuantity?: number;
  sourceLocation: "CDMX" | "MID";
  destinationLocation: "CDMX" | "MID";
}

interface ProcessReturnResponse {
  success: boolean;
  summary: {
    successful: number;
    failed: number;
  };
  results: {
    successful: ReturnResult[];
  };
  message?: string;
}

interface ReturnResult {
  roll_number: string;
  return_quantity: number;
  success: boolean;
}

interface Roll {
  roll_number: number;
  almacen: string;
  kg?: number;
  mts?: number;
}

interface PackingListEntry {
  packing_list_id: string;
  fabric_type: string;
  color: string;
  lot: number;
  rolls: Roll[];
}

interface InventoryCardProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  unitFilter: UnitType | "all";
  setUnitFilter: React.Dispatch<React.SetStateAction<UnitType | "all">>;
  ocFilter: string;
  setOcFilter: React.Dispatch<React.SetStateAction<string>>;
  telaFilter: string;
  setTelaFilter: React.Dispatch<React.SetStateAction<string>>;
  colorFilter: string;
  setColorFilter: React.Dispatch<React.SetStateAction<string>>;
  ubicacionFilter: string;
  setUbicacionFilter: React.Dispatch<React.SetStateAction<string>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  openNewOrder: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
}

interface UploadResult {
  uploadId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileUrl: string;
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
}

function processInventoryData(data: unknown[]): InventoryItem[] {
  const safeParseNumeric = (
    value: string | number | null | undefined
  ): number => {
    if (typeof value === "number") return value;
    return parseNumericValue(value);
  };

  const normalizeImportacion = (value: unknown): "DA" | "HOY" | "-" | "" => {
    if (value === null || value === undefined) return "-";

    const normalized = String(value).toLowerCase().trim();
    if (normalized === "hoy") return "HOY";
    if (normalized === "da") return "DA";
    if (normalized === "nan" || normalized === "") return "-";

    return "";
  };

  const filteredData = data.filter((item: unknown) => {
    const typedItem = item as RawInventoryItem;
    const isPending = typedItem.status === "pending";
    if (isPending) {
      console.log(
        `⏭️ [InventoryCard] Saltando item pending: ${typedItem.Tela} ${typedItem.Color} (status: ${typedItem.status})`
      );
      return false;
    }
    return true;
  });

  const processedItems: InventoryItem[] = [];

  filteredData.forEach((item: unknown) => {
    const typedItem = item as RawInventoryItem;

    const costo = safeParseNumeric(typedItem.Costo);
    const cantidad = safeParseNumeric(typedItem.Cantidad);

    if (isNaN(costo)) {
      console.warn(
        "⚠️ [InventoryCard] Valor de costo inválido:",
        typedItem.Costo
      );
    }
    if (isNaN(cantidad)) {
      console.warn(
        "⚠️ [InventoryCard] Valor de cantidad inválido:",
        typedItem.Cantidad
      );
    }

    let ubicacion = "";
    let cantidadFinal = cantidad;

    if (typedItem.almacen) {
      ubicacion = typedItem.almacen === "CDMX" ? "CDMX" : "Mérida";
      console.log(
        "✅ [InventoryCard] Usando columna 'almacen':",
        typedItem.almacen,
        "→",
        ubicacion
      );
    } else if (typedItem.CDMX !== undefined && typedItem.MID !== undefined) {
      const cantidadCDMX =
        typeof typedItem.CDMX === "number"
          ? typedItem.CDMX
          : parseNumericValue(typedItem.CDMX);
      const cantidadMID =
        typeof typedItem.MID === "number"
          ? typedItem.MID
          : parseNumericValue(typedItem.MID);

      if (cantidadCDMX > 0 && cantidadMID > 0) {
        const cdmxItem = {
          OC: String(typedItem.OC || ""),
          Tela: String(typedItem.Tela || ""),
          Color: String(typedItem.Color || ""),
          Costo: costo,
          Cantidad: cantidadCDMX,
          Unidades: (typedItem.Unidades || "") as UnitType,
          Total: costo * cantidadCDMX,
          Ubicacion: "CDMX",
          Importacion: normalizeImportacion(
            typedItem.Importacion ||
              typedItem["Importación"] ||
              typedItem["Importaci\u00f3n"] ||
              ""
          ),
          FacturaDragonAzteca: String(
            typedItem["Factura Dragón Azteca"] ||
              typedItem["Factura Dragon Azteca"] ||
              typedItem.FacturaDragonAzteca ||
              ""
          ),
        };

        processedItems.push(cdmxItem);

        const meridaItem = {
          OC: String(typedItem.OC || ""),
          Tela: String(typedItem.Tela || ""),
          Color: String(typedItem.Color || ""),
          Costo: costo,
          Cantidad: cantidadMID,
          Unidades: (typedItem.Unidades || "") as UnitType,
          Total: costo * cantidadMID,
          Ubicacion: "Mérida",
          Importacion: normalizeImportacion(
            typedItem.Importacion ||
              typedItem["Importación"] ||
              typedItem["Importaci\u00f3n"] ||
              ""
          ),
          FacturaDragonAzteca: String(
            typedItem["Factura Dragón Azteca"] ||
              typedItem["Factura Dragon Azteca"] ||
              typedItem.FacturaDragonAzteca ||
              ""
          ),
        };

        processedItems.push(meridaItem);

        return;
      } else if (cantidadCDMX > 0) {
        ubicacion = "CDMX";
        cantidadFinal = cantidadCDMX;
        console.log(
          "✅ [InventoryCard] Solo CDMX tiene cantidad:",
          cantidadCDMX
        );
      } else if (cantidadMID > 0) {
        ubicacion = "Mérida";
        cantidadFinal = cantidadMID;
        console.log(
          "✅ [InventoryCard] Solo Mérida tiene cantidad:",
          cantidadMID
        );
      } else {
        ubicacion = String(typedItem.Ubicacion || "");
        console.log(
          "⚠️ [InventoryCard] No hay cantidad específica, usando ubicación original:",
          ubicacion
        );
      }
    } else {
      ubicacion = String(typedItem.Ubicacion || "");

      if (!ubicacion) {
        const oc = String(typedItem.OC || "").toLowerCase();

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

        console.log(
          "🔧 [TEMPORAL] [InventoryCard] Asignando ubicación por patrón OC:",
          oc,
          "→",
          ubicacion
        );
      }
    }

    const finalItem = {
      OC: String(typedItem.OC || ""),
      Tela: String(typedItem.Tela || ""),
      Color: String(typedItem.Color || ""),
      Costo: costo,
      Cantidad: cantidadFinal,
      Unidades: (typedItem.Unidades || "") as UnitType,
      Total: costo * cantidadFinal,
      Ubicacion: ubicacion,
      Importacion: normalizeImportacion(
        typedItem.Importacion ||
          typedItem["Importación"] ||
          typedItem["Importaci\u00f3n"] ||
          ""
      ),
      FacturaDragonAzteca: String(
        typedItem["Factura Dragón Azteca"] ||
          typedItem["Factura Dragon Azteca"] ||
          typedItem.FacturaDragonAzteca ||
          ""
      ),
    };

    processedItems.push(finalItem);
  });

  console.log(
    "🎉 [InventoryCard] processInventoryData completado.",
    processedItems.length,
    "items procesados (sin pending)"
  );
  console.log("📊 [InventoryCard] Resumen de ubicaciones:");
  const ubicacionCount = processedItems.reduce(
    (acc: Record<string, number>, item: InventoryItem) => {
      acc[item.Ubicacion || "Sin ubicación"] =
        (acc[item.Ubicacion || "Sin ubicación"] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log(ubicacionCount);

  return processedItems;
}

const getAvailableYears = (): string[] => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];

  for (let year = 2025; year <= currentYear; year++) {
    years.push(year.toString());
  }

  return years;
};

export const InventoryCard: React.FC<InventoryCardProps> = ({
  inventory,
  setInventory,
  searchTerm,
  setSearchTerm,
  unitFilter,
  setUnitFilter,
  ocFilter,
  setOcFilter,
  telaFilter,
  setTelaFilter,
  colorFilter,
  setColorFilter,
  ubicacionFilter,
  setUbicacionFilter,
  isAdmin,
  isLoading,
  onLoadingChange,
}) => {
  const [inventoryCollapsed, setInventoryCollapsed] = useState(false);
  const [openSellDialog, setOpenSellDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openTransferDialog, setOpenTransferDialog] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null
  );
  const [quantityToUpdate, setQuantityToUpdate] = useState<number>(0);
  const [openInventoryDialog, setOpenInventoryDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("packing-list");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sellMode, setSellMode] = useState<"manual" | "rolls">("manual");
  const [transferMode, setTransferMode] = useState<"manual" | "rolls">(
    "manual"
  );
  const [packingListData, setPackingListData] = useState<PackingListEntry[]>(
    []
  );
  const [selectedRolls, setSelectedRolls] = useState<number[]>([]);
  const [selectedTransferRolls, setSelectedTransferRolls] = useState<number[]>(
    []
  );
  const [isLoadingPackingList, setIsLoadingPackingList] = useState(false);
  const [isLoadingTransferList, setIsLoadingTransferList] = useState(false);
  const [availableRolls, setAvailableRolls] = useState<Roll[]>([]);
  const [availableTransferRolls, setAvailableTransferRolls] = useState<Roll[]>(
    []
  );
  const [selectedLot, setSelectedLot] = useState<number | null>(null);
  const [availableLots, setAvailableLots] = useState<number[]>([]);
  const [rollsGroupedByLot, setRollsGroupedByLot] = useState<
    Map<number, Roll[]>
  >(new Map());
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isEditingInProgress, setIsEditingInProgress] = useState(false);
  const [openReturnsDialog, setOpenReturnsDialog] = useState(false);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [availableSoldRolls, setAvailableSoldRolls] = useState<ApiSoldRoll[]>(
    []
  );
  const [selectedReturnRolls, setSelectedReturnRolls] = useState<number[]>([]);
  const [isProcessingReturns, setIsProcessingReturns] = useState(false);
  const [isProcessingSell, setIsProcessingSell] = useState(false);
  const [selectedOCForReturns, setSelectedOCForReturns] = useState<string>("");
  const [selectedLotForReturns, setSelectedLotForReturns] =
    useState<string>("");
  const [availableOCs, setAvailableOCs] = useState<string[]>([]);
  const [availableLotsForReturns, setAvailableLotsForReturns] = useState<
    number[]
  >([]);
  const [groupedByOCAndLot, setGroupedByOCAndLot] = useState<
    Record<string, Record<number, ApiSoldRoll[]>>
  >({});
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [isCreatingRow, setIsCreatingRow] = useState(false);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof NewRowFormValues, string>>
  >({});
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<keyof NewRowFormValues, boolean>>
  >({});
  const [formData, setFormData] = useState<FormData>({
    OC: "",
    Tela: "",
    Color: "",
    Ubicacion: "",
    Cantidad: "",
    Costo: "",
    Unidades: "KGS",
    Importacion: "",
  });
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState<string>(
    (new Date().getMonth() + 1).toString().padStart(2, "0")
  );
  const [currentViewingYear, setCurrentViewingYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [currentViewingMonth, setCurrentViewingMonth] = useState<string>(
    (new Date().getMonth() + 1).toString().padStart(2, "0")
  );

  const isCurrentMonthAndYear = (): boolean => {
    const now = new Date();
    const actualCurrentYear = now.getFullYear().toString();
    const actualCurrentMonth = (now.getMonth() + 1).toString().padStart(2, "0");

    return (
      currentViewingYear === actualCurrentYear &&
      currentViewingMonth === actualCurrentMonth
    );
  };

  const handleOpenReturnsDialog = async () => {
    setOpenReturnsDialog(true);
    setIsLoadingReturns(true);
    setSelectedReturnRolls([]);
    setSelectedOCForReturns("");
    setSelectedLotForReturns("");
    setAvailableOCs([]);
    setAvailableLotsForReturns([]);
    setGroupedByOCAndLot({});

    try {
      console.log(
        "🔍 [RETURNS] Cargando rollos vendidos desde historial real..."
      );

      const response = await fetch(
        "/api/returns/get-sold-rolls?only_returnable=true&days=90&limit=1000"
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cargar rollos vendidos");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Respuesta no exitosa del servidor");
      }

      console.log("📊 [RETURNS] Datos recibidos:", data.summary);

      const availableRolls = data.rolls.filter(
        (roll: ApiSoldRoll) => roll.available_for_return
      );

      setAvailableSoldRolls(availableRolls);

      if (availableRolls.length === 0) {
        toast.info("No hay rollos disponibles para devolución en este momento");
        setIsLoadingReturns(false);
        return;
      }

      const groupedByOCAndLot: Record<
        string,
        Record<number, ApiSoldRoll[]>
      > = {};
      const ocsSet = new Set<string>();

      availableRolls.forEach((roll: ApiSoldRoll) => {
        const oc = roll.oc;
        const lot = roll.lot;

        ocsSet.add(oc);

        if (!groupedByOCAndLot[oc]) {
          groupedByOCAndLot[oc] = {};
        }

        if (!groupedByOCAndLot[oc][lot]) {
          groupedByOCAndLot[oc][lot] = [];
        }

        groupedByOCAndLot[oc][lot].push(roll);
      });

      const ocs = Array.from(ocsSet).sort();
      setAvailableOCs(ocs);
      setGroupedByOCAndLot(groupedByOCAndLot);

      if (ocs.length > 0) {
        const firstOC = ocs[0];
        setSelectedOCForReturns(firstOC);

        const lotsForFirstOC = Object.keys(groupedByOCAndLot[firstOC] || {})
          .map(Number)
          .sort((a, b) => a - b);
        setAvailableLotsForReturns(lotsForFirstOC);
      }
    } catch (error) {
      console.error("❌ [RETURNS] Error cargando rollos vendidos:", error);
      toast.error(
        `Error al cargar rollos vendidos: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      setAvailableSoldRolls([]);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  const handleCloseInventoryDialog = () => {
    setOpenInventoryDialog(false);
    setFormData({
      OC: "",
      Tela: "",
      Color: "",
      Ubicacion: "",
      Cantidad: "",
      Costo: "",
      Unidades: "KGS",
      Importacion: "",
    });
    setFormErrors({});
    setTouchedFields({});
    setUploadResult(null);
    setActiveTab("packing-list");
  };

  const validateField = (
    field: keyof NewRowFormValues,
    value: string | number,
    currentFormData: FormData,
    setFormErrors: React.Dispatch<
      React.SetStateAction<Partial<Record<keyof NewRowFormValues, string>>>
    >
  ) => {
    try {
      if (field === "Cantidad" || field === "Costo") {
        const numValue = parseFloat(value as string) || 0;
        if (field === "Cantidad" && numValue <= 0) {
          throw new Error("La cantidad debe ser mayor a 0");
        }
        if (field === "Costo" && numValue < 0) {
          throw new Error("El costo no puede ser negativo");
        }
      } else if (
        field === "OC" ||
        field === "Tela" ||
        field === "Color" ||
        field === "Ubicacion"
      ) {
        if (typeof value === "string" && value.trim() === "") {
          throw new Error("Este campo es requerido");
        }
      } else if (field === "Unidades") {
        if (value !== "KGS" && value !== "MTS") {
          throw new Error("Debe seleccionar KGS o MTS");
        }
      } else if (field === "Importacion") {
        if (
          typeof value === "string" &&
          value.trim() !== "" &&
          value !== "DA" &&
          value !== "HOY"
        ) {
          throw new Error("Debe seleccionar DA, HOY o dejar vacío");
        }
      }

      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    } catch (error) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: error instanceof Error ? error.message : "Error de validación",
      }));
    }
  };

  const formatInputNumber = (value: string): string => {
    const cleanValue = value.replace(/[^\d.]/g, "");
    const parts = cleanValue.split(".");
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (decimalPart !== undefined) {
      return `${formattedInteger}.${decimalPart}`;
    }

    return formattedInteger;
  };

  const parseInputNumber = (value: string): number => {
    const cleanValue = value.replace(/,/g, "");
    return parseFloat(cleanValue) || 0;
  };

  const handleOCChangeForReturns = (newOC: string) => {
    setSelectedOCForReturns(newOC);
    setSelectedLotForReturns("");
    setSelectedReturnRolls([]);

    const lotsForOC = Object.keys(groupedByOCAndLot[newOC] || {})
      .map(Number)
      .sort((a, b) => a - b);
    setAvailableLotsForReturns(lotsForOC);
  };

  const handleLotChangeForReturns = (newLot: string) => {
    setSelectedLotForReturns(newLot === "all" ? "" : newLot);
    setSelectedReturnRolls([]);
  };

  const getFilteredRollsForReturns = (): ApiSoldRoll[] => {
    if (!selectedOCForReturns || !groupedByOCAndLot[selectedOCForReturns]) {
      return [];
    }

    let rolls: ApiSoldRoll[] = [];

    if (selectedLotForReturns) {
      const lotNumber = parseInt(selectedLotForReturns);
      rolls = groupedByOCAndLot[selectedOCForReturns][lotNumber] || [];
    } else {
      Object.values(groupedByOCAndLot[selectedOCForReturns]).forEach(
        (lotRolls) => {
          rolls.push(...lotRolls);
        }
      );
    }

    return rolls.filter((roll: ApiSoldRoll) => roll.available_for_return);
  };

  const calculateTotalReturnQuantityFiltered = (): number => {
    const filteredRolls = getFilteredRollsForReturns();
    return filteredRolls
      .filter((_: ApiSoldRoll, index: number) =>
        selectedReturnRolls.includes(index)
      )
      .reduce(
        (total: number, roll: ApiSoldRoll) => total + roll.sold_quantity,
        0
      );
  };

  const handleReturnRollSelectionFiltered = (rollIndex: number) => {
    setSelectedReturnRolls((prev) => {
      if (prev.includes(rollIndex)) {
        return prev.filter((i) => i !== rollIndex);
      } else {
        return [...prev, rollIndex];
      }
    });
  };

  const handleProcessReturnsWithData = async (
    rollsToReturn: ReturnRollData[]
  ) => {
    if (rollsToReturn.length === 0) {
      toast.error("Seleccione al menos un rollo para devolver");
      return;
    }

    setIsProcessingReturns(true);

    try {
      console.log("🔄 [RETURNS] Iniciando procesamiento de devoluciones...");

      const response = await fetch("/api/returns/process-returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rolls: rollsToReturn,
          return_reason:
            "Devolución procesada desde interfaz de administración",
          notes: `Devolución de ${
            rollsToReturn.length
          } rollos de la OC ${selectedOCForReturns}${
            selectedLotForReturns ? ` - Lote ${selectedLotForReturns}` : ""
          }`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al procesar la devolución");
      }

      const result: ProcessReturnResponse = await response.json();

      if (!result.success) {
        throw new Error(result.message || "El procesamiento no fue exitoso");
      }

      if (result.summary.successful > 0) {
        toast.success("Devolución exitosa");

        if (result.results.successful.length > 0) {
          const updatedInventory = [...inventory];

          for (const returnedRoll of result.results
            .successful as ReturnResult[]) {
            const rollData = rollsToReturn.find(
              (r: ReturnRollData) => r.roll_number === returnedRoll.roll_number
            );
            if (!rollData) continue;

            const existingIndex = updatedInventory.findIndex(
              (item: InventoryItem) =>
                item.OC === rollData.oc &&
                item.Tela === rollData.fabric_type &&
                item.Color === rollData.color &&
                item.Ubicacion === rollData.almacen
            );

            if (existingIndex >= 0) {
              updatedInventory[existingIndex].Cantidad +=
                rollData.return_quantity;
              updatedInventory[existingIndex].Total =
                updatedInventory[existingIndex].Costo *
                updatedInventory[existingIndex].Cantidad;
            } else {
              const newItem = {
                OC: rollData.oc,
                Tela: rollData.fabric_type,
                Color: rollData.color,
                Costo: rollData.costo,
                Cantidad: rollData.return_quantity,
                Unidades: rollData.units as UnitType,
                Total: rollData.costo * rollData.return_quantity,
                Ubicacion: rollData.almacen,
                Importacion: "" as "DA" | "HOY",
                FacturaDragonAzteca: "",
              };
              updatedInventory.push(newItem);
            }
          }

          setInventory(updatedInventory);
        }

        if (result.summary.failed > 0) {
          toast.warning(
            `⚠️ ${result.summary.failed} rollos no pudieron ser procesados completamente`
          );
        }

        setOpenReturnsDialog(false);
      } else {
        toast.error(
          `❌ No se pudieron procesar las devoluciones: ${result.message}`
        );
      }
    } catch (error) {
      console.error("❌ [RETURNS] Error procesando devoluciones:", error);
      toast.error(
        `Error al procesar devoluciones: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      setIsProcessingReturns(false);
    }
  };

  const handleOpenEditDialog = (item: InventoryItem) => {
    const originalIndex = inventory.findIndex(
      (originalItem) =>
        originalItem.OC === item.OC &&
        originalItem.Tela === item.Tela &&
        originalItem.Color === item.Color &&
        originalItem.Ubicacion === item.Ubicacion &&
        Math.abs(originalItem.Costo - item.Costo) < 0.01 &&
        Math.abs(originalItem.Cantidad - item.Cantidad) < 0.01
    );

    if (originalIndex === -1) {
      toast.error("No se pudo encontrar el item en el inventario original");
      return;
    }

    setSelectedItemIndex(originalIndex);
    setEditingItem({ ...item });
    setOpenEditDialog(true);
  };

  const handleEditItem = async () => {
    if (selectedItemIndex !== null && editingItem) {
      setIsEditingInProgress(true);

      const oldItem = {
        OC: inventory[selectedItemIndex].OC,
        Tela: inventory[selectedItemIndex].Tela,
        Color: inventory[selectedItemIndex].Color,
        Ubicacion: inventory[selectedItemIndex].Ubicacion,
        Cantidad: inventory[selectedItemIndex].Cantidad,
        Costo: inventory[selectedItemIndex].Costo,
        Unidades: inventory[selectedItemIndex].Unidades,
        Importacion: inventory[selectedItemIndex].Importacion,
        FacturaDragonAzteca:
          inventory[selectedItemIndex].FacturaDragonAzteca || "",
      };

      const locationForAPI =
        editingItem.Ubicacion === "Mérida" ? "MID" : "CDMX";

      const updatedInventory = [...inventory];
      updatedInventory[selectedItemIndex] = {
        ...editingItem,
        Total: editingItem.Costo * editingItem.Cantidad,
      };

      setInventory(updatedInventory);

      try {
        const response = await fetch("/api/s3/inventario/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            oldItem,
            newItem: {
              ...editingItem,
              Total: editingItem.Costo * editingItem.Cantidad,
            },
            isEdit: true,
            location: locationForAPI,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ [EDIT] Error response:", errorData);

          setInventory(inventory);

          throw new Error(errorData.error || "Error al actualizar inventario");
        }

        toast.success("Producto actualizado correctamente");
      } catch (error) {
        console.error("❌ [EDIT] Error al actualizar inventario:", error);

        setInventory(inventory);

        toast.error(
          `Error al actualizar el producto: ${
            error instanceof Error ? error.message : "Error desconocido"
          }`
        );
      } finally {
        setIsEditingInProgress(false);
      }

      setOpenEditDialog(false);
      setEditingItem(null);
    }
  };

  const resetAllFilters = () => {
    setSearchTerm("");
    setUnitFilter("all");
    setOcFilter("all");
    setTelaFilter("all");
    setColorFilter("all");
    setUbicacionFilter("all");
  };

  const isFilterActive = useMemo(() => {
    return (
      searchTerm !== "" ||
      unitFilter !== "all" ||
      ocFilter !== "all" ||
      telaFilter !== "all" ||
      colorFilter !== "all" ||
      ubicacionFilter !== "all"
    );
  }, [
    searchTerm,
    unitFilter,
    ocFilter,
    telaFilter,
    colorFilter,
    ubicacionFilter,
  ]);

  const toggleInventoryCollapsed = () => {
    const newState = !inventoryCollapsed;
    setInventoryCollapsed(newState);

    if (newState && isFilterActive) {
      setSearchTerm("");
      setUnitFilter("all");
      setOcFilter("all");
      setTelaFilter("all");
      setColorFilter("all");
      setUbicacionFilter("all");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleOpenInventoryDialog = () => {
    setOpenInventoryDialog(true);
    setUploadResult(null);
    setActiveTab("packing-list");
    setFormData({
      OC: "",
      Tela: "",
      Color: "",
      Ubicacion: "",
      Cantidad: "",
      Costo: "",
      Unidades: "KGS",
      Importacion: "",
    });
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

      const response = await fetch("/api/packing-list/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al subir el Packing List");
      }

      const result = await response.json();
      setUploadResult(result);

      toast.success("Archivo subido correctamente al bucket S3");

      console.log("🚀 [InventoryCard] Disparando evento packing-list-uploaded");
      const event = new CustomEvent("packing-list-uploaded", {
        detail: {
          fileName: file.name,
          uploadId: result.uploadId,
          uploadedAt: new Date().toISOString(),
          result: result,
        },
      });

      window.dispatchEvent(event);
      console.log(
        "✅ [InventoryCard] Evento packing-list-uploaded disparado exitosamente"
      );
    } catch (error) {
      console.error("Error al subir PACKING LIST:", error);
      toast.error(
        typeof error === "object" && error !== null && "message" in error
          ? (error as Error).message
          : "Error al subir el archivo PACKING LIST"
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

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setTouchedFields((prev) => ({
      ...prev,
      [field]: true,
    }));

    validateField(
      field as keyof NewRowFormValues,
      value,
      {
        ...formData,
        [field]: value,
      },
      setFormErrors
    );
  };

  const validateForm = (): boolean => {
    try {
      const dataToValidate = {
        ...formData,
        Cantidad: parseFloat(formData.Cantidad) || 0,
        Costo: parseFloat(formData.Costo) || 0,
      };

      newRowSchema.parse(dataToValidate);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof NewRowFormValues, string>> = {};

        error.errors.forEach((err: ZodError) => {
          const field = err.path[0] as keyof NewRowFormValues;
          newErrors[field] = err.message;
        });

        setFormErrors(newErrors);

        const allFields: Partial<Record<keyof NewRowFormValues, boolean>> = {};
        Object.keys(formData).forEach((key) => {
          allFields[key as keyof NewRowFormValues] = true;
        });
        setTouchedFields(allFields);
      }
      return false;
    }
  };

  const handleCreateRow = async () => {
    if (!validateForm()) {
      return;
    }

    setIsCreatingRow(true);

    try {
      console.log("🚀 [NEW-ROW] === CREANDO NUEVA ROW ===");
      console.log("📋 [NEW-ROW] Datos a enviar:", formData);

      const requestBody = {
        ...formData,
        Cantidad: parseFloat(formData.Cantidad),
        Costo: parseFloat(formData.Costo),
      };

      const response = await fetch("/api/s3/inventario/create-row", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear la nueva row");
      }

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
      });

      handleCloseInventoryDialog();
      handleReloadInventory();
    } catch (error) {
      console.error("❌ [NEW-ROW] Error:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al crear la nueva row"
      );
    } finally {
      setIsCreatingRow(false);
    }
  };

  const handleReloadInventory = async () => {
    try {
      if (onLoadingChange) {
        onLoadingChange(true);
      }

      const now = new Date();
      const currentYear = now.getFullYear().toString();
      const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");
      const apiUrl = `/api/s3/inventario?year=${currentYear}&month=${currentMonth}`;

      const response = await fetch(apiUrl);
      const jsonData = await response.json();

      if (jsonData.data && Array.isArray(jsonData.data)) {
        const parsedData = processInventoryData(jsonData.data);
        setInventory(parsedData);

        setCurrentViewingYear(currentYear);
        setCurrentViewingMonth(currentMonth);

        toast.success("Inventario actualizado con éxito");
      }
    } catch (error) {
      console.error("Error recargando inventario:", error);
      toast.error("Error recargando inventario");
    } finally {
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  const loadPackingListData = async (
    tela: string,
    color: string,
    ubicacion: string,
    oc?: string
  ) => {
    setIsLoadingPackingList(true);
    try {
      console.log(`🔍 [PACKING-LIST] Cargando rollos para venta:`, {
        tela,
        color,
        ubicacion,
        oc,
      });

      const response = await fetch(
        `/api/packing-list/get-rolls?tela=${encodeURIComponent(
          tela
        )}&color=${encodeURIComponent(color)}${oc ? `&oc=${encodeURIComponent(oc)}` : ''}`
      );

      if (!response.ok) {
        throw new Error("Error al cargar los datos del packing list");
      }

      const data: PackingListEntry[] = await response.json();

      let normalizedData: PackingListEntry[];
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && typeof data === "object") {
        const keys = Object.keys(data)
          .filter((key) => !isNaN(Number(key)))
          .sort((a, b) => Number(a) - Number(b));
        normalizedData = keys.map(
          (key) => data[key as keyof typeof data]
        ) as PackingListEntry[];
      } else {
        normalizedData = [];
      }

      setPackingListData(normalizedData);

      if (normalizedData.length === 0) {
        toast.info(
          `No se encontraron rollos en el packing list para ${tela} ${color}`
        );
        setAvailableRolls([]);
        setSelectedLot(null);
        setAvailableLots([]);
        setRollsGroupedByLot(new Map());
        return;
      }

      const matchingEntries = normalizedData.filter(
        (entry) => entry.fabric_type === tela && entry.color === color
      );

      console.log(
        `📦 [PACKING-LIST] Entries encontradas:`,
        matchingEntries.length
      );

      if (matchingEntries.length > 0) {
        const groupedByLot = new Map<number, Roll[]>();
        const lots: number[] = [];

        matchingEntries.forEach((entry) => {
          const lotNumber =
            typeof entry.lot === "string" ? parseInt(entry.lot) : entry.lot;

          if (!lots.includes(lotNumber)) {
            lots.push(lotNumber);
          }

          const rollsFromLocation = (
            entry.rolls as unknown as PackingListRollData[]
          )
            .filter((roll) => {
              const rollLocation = roll.almacen === "CDMX" ? "CDMX" : "Mérida";
              const matches = rollLocation === ubicacion;

              return matches;
            })
            .map((roll: PackingListRollData) => {
              const mappedRoll: Roll = {
                roll_number: roll.roll_number,
                almacen: roll.almacen || "",
              };

              if (roll.unidad === "KG" || roll.unidad === "KGS") {
                mappedRoll.kg = roll.weight;
              } else {
                mappedRoll.mts = roll.weight;
              }

              return mappedRoll;
            });

          if (rollsFromLocation.length > 0) {
            const existingRolls = groupedByLot.get(lotNumber) || [];
            groupedByLot.set(lotNumber, [
              ...existingRolls,
              ...rollsFromLocation,
            ]);
          }
        });

        const lotsWithRolls = lots.filter((lot) => {
          const rollsInLot = groupedByLot.get(lot) || [];
          return rollsInLot.length > 0;
        });

        setAvailableLots(lotsWithRolls.sort((a, b) => a - b));
        setRollsGroupedByLot(groupedByLot);

        if (lotsWithRolls.length > 0) {
          setSelectedLot(lotsWithRolls[0]);
          setAvailableRolls(groupedByLot.get(lotsWithRolls[0]) || []);
        } else {
          setSelectedLot(null);
          setAvailableRolls([]);
          console.log(
            `⚠️ [PACKING-LIST] No hay rollos disponibles en ${ubicacion} para ${tela} ${color}`
          );
        }
      } else {
        setAvailableRolls([]);
        setSelectedLot(null);
        setAvailableLots([]);
        setRollsGroupedByLot(new Map());
      }
    } catch (error) {
      console.error("Error al cargar packing list:", error);
      toast.info(
        `No se encontraron rollos de packing list para ${tela} ${color}`
      );
      setPackingListData([]);
      setAvailableRolls([]);
      setSelectedLot(null);
      setAvailableLots([]);
      setRollsGroupedByLot(new Map());
    } finally {
      setIsLoadingPackingList(false);
    }
  };

  const loadTransferPackingListData = async (tela: string, color: string, oc?: string) => {
    setIsLoadingTransferList(true);
    try {
      console.log(
        `🔄 [TRANSFER-PACKING-LIST] Cargando rollos para traslado desde CDMX:`,
        {
          tela,
          color,
          oc,
        }
      );

      const response = await fetch(
        `/api/packing-list/get-rolls?tela=${encodeURIComponent(
          tela
        )}&color=${encodeURIComponent(color)}${oc ? `&oc=${encodeURIComponent(oc)}` : ''}`
      );

      if (!response.ok) {
        throw new Error("Error al cargar los datos del packing list");
      }

      const data: PackingListEntry[] = await response.json();

      let normalizedData: PackingListEntry[];
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && typeof data === "object") {
        const keys = Object.keys(data)
          .filter((key) => !isNaN(Number(key)))
          .sort((a, b) => Number(a) - Number(b));
        normalizedData = keys.map(
          (key) => data[key as keyof typeof data]
        ) as PackingListEntry[];
      } else {
        normalizedData = [];
      }

      const matchingEntries = normalizedData.filter(
        (entry) => entry.fabric_type === tela && entry.color === color
      );

      if (matchingEntries.length > 0) {
        const groupedByLot = new Map<number, Roll[]>();
        const lots: number[] = [];

        matchingEntries.forEach((entry) => {
          const lotNumber =
            typeof entry.lot === "string" ? parseInt(entry.lot) : entry.lot;

          if (!lots.includes(lotNumber)) {
            lots.push(lotNumber);
          }

          const cdmxRolls = (entry.rolls as unknown as PackingListRollData[])
            .filter((roll) => roll.almacen === "CDMX")
            .map((roll: PackingListRollData) => {
              const mappedRoll: Roll = {
                roll_number: roll.roll_number,
                almacen: roll.almacen || "",
              };

              if (roll.unidad === "KG" || roll.unidad === "KGS") {
                mappedRoll.kg = roll.weight;
              } else {
                mappedRoll.mts = roll.weight;
              }

              return mappedRoll;
            });

          if (cdmxRolls.length > 0) {
            const existingRolls = groupedByLot.get(lotNumber) || [];
            groupedByLot.set(lotNumber, [...existingRolls, ...cdmxRolls]);
          }
        });

        const lotsWithCdmxRolls = lots.filter((lot) => {
          const rollsInLot = groupedByLot.get(lot) || [];
          return rollsInLot.length > 0;
        });

        setAvailableLots(lotsWithCdmxRolls.sort((a, b) => a - b));
        setRollsGroupedByLot(groupedByLot);

        if (lotsWithCdmxRolls.length > 0) {
          setSelectedLot(lotsWithCdmxRolls[0]);
          setAvailableTransferRolls(
            groupedByLot.get(lotsWithCdmxRolls[0]) || []
          );
        }
      }
    } catch (error) {
      console.error("Error al cargar packing list para traslado:", error);
      toast.error("Error al cargar los datos de los rollos para traslado");
    } finally {
      setIsLoadingTransferList(false);
    }
  };

  const handleLotChange = (lot: number) => {
    setSelectedLot(lot);
    setAvailableRolls(rollsGroupedByLot.get(lot) || []);
    setSelectedRolls([]);
  };

  const handleLotChangeForTransfer = (lot: number) => {
    setSelectedLot(lot);
    const cdmxRolls =
      rollsGroupedByLot.get(lot)?.filter((roll) => roll.almacen === "CDMX") ||
      [];
    setAvailableTransferRolls(cdmxRolls);
    setSelectedTransferRolls([]);
  };

  const calculateTotalFromRolls = () => {
    return availableRolls
      .filter((_, index) => selectedRolls.includes(index))
      .reduce((total, roll) => total + (roll.kg || roll.mts || 0), 0);
  };

  const calculateTotalFromTransferRolls = () => {
    return availableTransferRolls
      .filter((_, index) => selectedTransferRolls.includes(index))
      .reduce((total, roll) => total + (roll.kg || roll.mts || 0), 0);
  };

  const handleRollSelection = (rollIndex: number) => {
    setSelectedRolls((prev) => {
      if (prev.includes(rollIndex)) {
        return prev.filter((i) => i !== rollIndex);
      } else {
        return [...prev, rollIndex];
      }
    });
  };

  const handleTransferRollSelection = (rollIndex: number) => {
    setSelectedTransferRolls((prev) => {
      if (prev.includes(rollIndex)) {
        return prev.filter((i) => i !== rollIndex);
      } else {
        return [...prev, rollIndex];
      }
    });
  };

  const handleOpenSellDialog = (item: InventoryItem) => {
    const originalIndex = inventory.findIndex(
      (originalItem) =>
        originalItem.OC === item.OC &&
        originalItem.Tela === item.Tela &&
        originalItem.Color === item.Color &&
        originalItem.Ubicacion === item.Ubicacion &&
        Math.abs(originalItem.Costo - item.Costo) < 0.01 &&
        Math.abs(originalItem.Cantidad - item.Cantidad) < 0.01
    );

    if (originalIndex === -1) {
      toast.error("No se pudo encontrar el item en el inventario original");
      return;
    }

    setSelectedItemIndex(originalIndex);
    setQuantityToUpdate(0);
    setSellMode("manual");
    setSelectedRolls([]);
    setAvailableRolls([]);
    setSelectedLot(null);
    setIsProcessingSell(false);
    setOpenSellDialog(true);

    loadPackingListData(item.Tela, item.Color, item.Ubicacion || "CDMX", item.OC);
  };

  const handleOpenTransferDialog = (item: InventoryItem) => {
    const originalIndex = inventory.findIndex(
      (originalItem) =>
        originalItem.OC === item.OC &&
        originalItem.Tela === item.Tela &&
        originalItem.Color === item.Color &&
        originalItem.Ubicacion === item.Ubicacion &&
        Math.abs(originalItem.Costo - item.Costo) < 0.01 &&
        Math.abs(originalItem.Cantidad - item.Cantidad) < 0.01
    );

    if (originalIndex === -1) {
      toast.error("No se pudo encontrar el item en el inventario original");
      return;
    }

    setSelectedItemIndex(originalIndex);
    setQuantityToUpdate(0);
    setTransferMode("manual");
    setSelectedTransferRolls([]);
    setAvailableTransferRolls([]);
    setSelectedLot(null);
    setOpenTransferDialog(true);

    loadTransferPackingListData(item.Tela, item.Color, item.OC);
  };

  const handleSellItem = async () => {
    if (selectedItemIndex !== null) {
      const item = inventory[selectedItemIndex];
      let quantityToSell = 0;

      if (sellMode === "manual") {
        quantityToSell = quantityToUpdate;
      } else if (sellMode === "rolls" && selectedRolls.length > 0) {
        quantityToSell = calculateTotalFromRolls();
      }

      if (quantityToSell <= 0) {
        toast.error(
          "Por favor, seleccione una cantidad válida o rollos para vender"
        );
        return;
      }

      if (quantityToSell > item.Cantidad) {
        toast.error(
          "La cantidad a vender no puede ser mayor que el inventario disponible"
        );
        return;
      }

      setIsProcessingSell(true);

      try {
        console.log("🛒 [SELL] Iniciando venta de producto:", {
          OC: item.OC,
          Tela: item.Tela,
          Color: item.Color,
          Ubicacion: item.Ubicacion,
          CantidadActual: item.Cantidad,
          CantidadAVender: quantityToSell,
          Modo: sellMode,
        });

        const locationForAPI = item.Ubicacion === "Mérida" ? "MID" : "CDMX";

        const inventoryUpdatePayload = {
          oldItem: {
            OC: item.OC || "",
            Tela: item.Tela || "",
            Color: item.Color || "",
            Ubicacion: item.Ubicacion || "",
            Cantidad: item.Cantidad,
            Costo: item.Costo,
            Unidades: item.Unidades || "",
          },
          quantityChange: quantityToSell,
          location: locationForAPI,
        };

        console.log("📦 [SELL] Enviando payload a S3:", inventoryUpdatePayload);

        const inventoryUpdateResponse = await fetch(
          "/api/s3/inventario/update",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(inventoryUpdatePayload),
          }
        );

        if (!inventoryUpdateResponse.ok) {
          const errorData = await inventoryUpdateResponse.json();
          console.error("❌ [SELL] Error respuesta S3:", errorData);
          throw new Error(
            errorData.error || "Error al actualizar inventario en S3"
          );
        }

        const updatedInventory = [...inventory];

        const newQuantity = item.Cantidad - quantityToSell;
        if (newQuantity > 0) {
          updatedInventory[selectedItemIndex] = {
            ...item,
            Cantidad: newQuantity,
            Total: item.Costo * newQuantity,
          };
        } else {
          updatedInventory.splice(selectedItemIndex, 1);
          console.log(
            `🗑️ [SELL] Item removido del inventario local (cantidad = 0)`
          );
        }

        setInventory(updatedInventory);

        try {
          console.log("💾 [SELL] Guardando venta en historial...");

          let soldRollsData: SoldRollHistoryData[] = [];

          if (sellMode === "rolls" && selectedRolls.length > 0) {
            soldRollsData = selectedRolls.map((rollIndex) => {
              const roll = availableRolls[rollIndex];
              return {
                roll_number: roll.roll_number.toString(),
                fabric_type: item.Tela,
                color: item.Color,
                lot: selectedLot!,
                oc: item.OC,
                almacen: roll.almacen,
                sold_quantity: roll.kg || roll.mts || 0,
                units: item.Unidades,
                costo: item.Costo,
                sold_date: new Date().toISOString(),
                sold_by: "",
                available_for_return: true,
                sale_type: "rolls",
              };
            });
          } else if (sellMode === "manual") {
            const currentDate = new Date();
            const timestamp = currentDate.getTime();
            const manualRollNumber = `MANUAL-${timestamp.toString().slice(-6)}`;

            soldRollsData = [
              {
                roll_number: manualRollNumber,
                fabric_type: item.Tela,
                color: item.Color,
                lot: 0,
                oc: item.OC,
                almacen: item.Ubicacion,
                sold_quantity: quantityToSell,
                units: item.Unidades,
                costo: item.Costo,
                sold_date: currentDate.toISOString(),
                sold_by: "",
                available_for_return: true,
                sale_type: "manual",
              },
            ];
          }

          if (soldRollsData.length > 0) {
            const salesResponse = await fetch("/api/sales/save-sold-rolls", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                rolls: soldRollsData,
                sale_notes:
                  sellMode === "rolls"
                    ? `Venta de ${selectedRolls.length} rollos del lote ${selectedLot}`
                    : `Venta manual de ${quantityToSell.toFixed(2)} ${
                        item.Unidades
                      }`,
                customer_info: "",
              }),
            });

            if (!salesResponse.ok) {
              const salesError = await salesResponse.json();
              console.error("❌ [SELL] Error en historial:", salesError);
              throw new Error(
                salesError.error || "Error al guardar historial de ventas"
              );
            }
          }

          if (sellMode === "rolls" && selectedRolls.length > 0) {
            const packingResponse = await fetch(
              "/api/packing-list/update-rolls",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  tela: item.Tela,
                  color: item.Color,
                  lot: selectedLot,
                  soldRolls: selectedRolls.map(
                    (index) => availableRolls[index].roll_number
                  ),
                }),
              }
            );

            if (!packingResponse.ok) {
              throw new Error("Error al actualizar el packing list");
            }

            await loadPackingListData(item.Tela, item.Color, item.Ubicacion, item.OC);

            toast.success("Venta completada con éxito");
          } else {
            toast.success("Venta completada con éxito");
          }
        } catch (error) {
          console.error("❌ [SELL] Error en procesos secundarios:", error);
          toast.warning(
            `Inventario actualizado, pero error en: ${
              error instanceof Error ? error.message : "proceso secundario"
            }`
          );
        }

        setOpenSellDialog(false);
      } catch (error) {
        console.error("❌ [SELL] Error general:", error);
        toast.error(
          `Error en la venta: ${
            error instanceof Error ? error.message : "Error desconocido"
          }`
        );
      } finally {
        setIsProcessingSell(false);
      }
    }
  };

  const handleAddItem = () => {
    if (selectedItemIndex !== null && quantityToUpdate > 0) {
      const updatedInventory = [...inventory];
      const item = updatedInventory[selectedItemIndex];

      updatedInventory[selectedItemIndex] = {
        ...item,
        Cantidad: item.Cantidad + quantityToUpdate,
        Total: item.Costo * (item.Cantidad + quantityToUpdate),
      };

      setInventory(updatedInventory);
      setOpenAddDialog(false);
      toast.success(
        `Se agregaron ${quantityToUpdate} ${item.Unidades} de ${item.Tela} ${item.Color}`
      );
    }
  };

  const handleTransferItem = async () => {
    if (selectedItemIndex !== null) {
      const item = inventory[selectedItemIndex];

      console.log("🚀 INICIANDO TRASLADO CON CONSOLIDACIÓN:", {
        item: {
          OC: item.OC,
          Tela: item.Tela,
          Color: item.Color,
          Ubicacion: item.Ubicacion,
          Cantidad: item.Cantidad,
          Costo: item.Costo,
          Unidades: item.Unidades,
        },
        transferMode,
        selectedTransferRolls: selectedTransferRolls.length,
      });

      if (item.Ubicacion !== "CDMX") {
        toast.error("Solo se pueden trasladar productos que están en CDMX");
        return;
      }

      let quantityToTransfer = 0;

      if (transferMode === "manual") {
        quantityToTransfer = quantityToUpdate;
      } else if (transferMode === "rolls" && selectedTransferRolls.length > 0) {
        quantityToTransfer = calculateTotalFromTransferRolls();
      }

      if (quantityToTransfer <= 0) {
        toast.error(
          "Por favor, seleccione una cantidad válida o rollos para trasladar"
        );
        return;
      }

      if (quantityToTransfer > item.Cantidad) {
        toast.error(
          "La cantidad a trasladar no puede ser mayor que el inventario disponible en CDMX"
        );
        return;
      }

      setIsProcessingTransfer(true);

      const oldItem = {
        OC: item.OC || "",
        Tela: item.Tela || "",
        Color: item.Color || "",
        Ubicacion: item.Ubicacion || "",
        Cantidad: item.Cantidad,
        Costo: item.Costo,
        Unidades: item.Unidades || "",
      };

      const existingMeridaItem = inventory.find(
        (invItem) =>
          invItem.Tela.toLowerCase() === item.Tela.toLowerCase() &&
          invItem.Color.toLowerCase() === item.Color.toLowerCase() &&
          invItem.Ubicacion === "Mérida" &&
          invItem.OC === item.OC &&
          Math.abs(invItem.Costo - item.Costo) < 0.01 &&
          invItem.Unidades === item.Unidades
      );

      console.log("🔍 BÚSQUEDA DE ITEM CONSOLIDABLE:", {
        found: !!existingMeridaItem,
        criteria: {
          OC: item.OC,
          Tela: item.Tela,
          Color: item.Color,
          Ubicacion: "Mérida",
          Costo: item.Costo,
          Unidades: item.Unidades,
        },
        existingItem: existingMeridaItem
          ? {
              OC: existingMeridaItem.OC,
              Cantidad: existingMeridaItem.Cantidad,
              Ubicacion: existingMeridaItem.Ubicacion,
            }
          : null,
      });

      let updatePayload: TransferUpdatePayload;

      if (existingMeridaItem) {
        updatePayload = {
          transferType: "consolidate",
          oldItem,
          existingMeridaItem: {
            OC: existingMeridaItem.OC,
            Tela: existingMeridaItem.Tela,
            Color: existingMeridaItem.Color,
            Ubicacion: existingMeridaItem.Ubicacion,
            Cantidad: existingMeridaItem.Cantidad,
            Costo: existingMeridaItem.Costo,
            Unidades: existingMeridaItem.Unidades,
          },
          quantityToTransfer,
          newMeridaQuantity: existingMeridaItem.Cantidad + quantityToTransfer,
          sourceLocation: "CDMX",
          destinationLocation: "MID",
        };
      } else {
        console.log("🆕 CREANDO NUEVO ITEM EN MÉRIDA");

        const newMeridaItem = {
          OC: item.OC || "",
          Tela: item.Tela || "",
          Color: item.Color || "",
          Ubicacion: "Mérida",
          Cantidad: quantityToTransfer,
          Costo: item.Costo,
          Unidades: item.Unidades || "",
          Total: item.Costo * quantityToTransfer,
          Importacion: item.Importacion || "",
          FacturaDragonAzteca: item.FacturaDragonAzteca || "",
          status: "completed",
        };

        updatePayload = {
          transferType: "create",
          oldItem,
          newItem: newMeridaItem,
          quantityToTransfer,
          sourceLocation: "CDMX",
          destinationLocation: "MID",
        };
      }

      const updatedInventory = [...inventory];

      updatedInventory[selectedItemIndex] = {
        ...item,
        Cantidad: item.Cantidad - quantityToTransfer,
        Total: item.Costo * (item.Cantidad - quantityToTransfer),
      };

      if (existingMeridaItem) {
        const meridaIndex = updatedInventory.findIndex(
          (invItem) =>
            invItem.Tela.toLowerCase() ===
              existingMeridaItem.Tela.toLowerCase() &&
            invItem.Color.toLowerCase() ===
              existingMeridaItem.Color.toLowerCase() &&
            invItem.Ubicacion === "Mérida" &&
            invItem.OC === existingMeridaItem.OC &&
            Math.abs(invItem.Costo - existingMeridaItem.Costo) < 0.01
        );

        if (meridaIndex >= 0) {
          updatedInventory[meridaIndex] = {
            ...updatedInventory[meridaIndex],
            Cantidad:
              updatedInventory[meridaIndex].Cantidad + quantityToTransfer,
            Total:
              updatedInventory[meridaIndex].Costo *
              (updatedInventory[meridaIndex].Cantidad + quantityToTransfer),
          };

          console.log(
            `📈 ESTADO LOCAL: Cantidad consolidada en Mérida: ${
              updatedInventory[meridaIndex].Cantidad - quantityToTransfer
            } -> ${updatedInventory[meridaIndex].Cantidad}`
          );
        }
      } else {
        if (updatePayload.newItem) {
          updatedInventory.push(updatePayload.newItem as InventoryItem);
          console.log("➕ ESTADO LOCAL: Nuevo item agregado en Mérida");
        }
      }

      setInventory(updatedInventory);

      let inventoryUpdateSuccess = false;
      let packingListUpdateSuccess = false;

      try {
        try {
          console.log(
            "📦 ENVIANDO PAYLOAD DE CONSOLIDACIÓN AL BACKEND:",
            updatePayload
          );

          const inventoryUpdateResponse = await fetch(
            "/api/s3/inventario/update",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(updatePayload),
            }
          );

          const inventoryResponseData = await inventoryUpdateResponse.json();
          console.log(
            "📦 RESPUESTA BACKEND CONSOLIDACIÓN:",
            inventoryResponseData
          );

          if (!inventoryUpdateResponse.ok) {
            throw new Error(
              inventoryResponseData.error ||
                inventoryResponseData.details ||
                "Error al procesar traslado con consolidación"
            );
          }

          inventoryUpdateSuccess = true;

          if (inventoryResponseData.operation === "consolidate") {
            toast.success("Traslado realizado exitosamente");
          } else if (inventoryResponseData.operation === "create") {
            toast.success("Nuevo item creado en Mérida");
          }
        } catch (inventoryError) {
          console.error(
            "❌ ERROR AL ACTUALIZAR INVENTARIO CON CONSOLIDACIÓN:",
            inventoryError
          );

          setInventory(inventory);

          toast.error(
            `Error en consolidación: ${
              inventoryError instanceof Error
                ? inventoryError.message
                : String(inventoryError)
            }`
          );
          return;
        }

        if (transferMode === "rolls" && selectedTransferRolls.length > 0) {
          try {
            console.log("📋 ACTUALIZANDO PACKING LIST...", {
              tela: item.Tela,
              color: item.Color,
              lot: selectedLot,
              transferRolls: selectedTransferRolls.map(
                (index) => availableTransferRolls[index].roll_number
              ),
            });

            const response = await fetch("/api/packing-list/transfer-rolls", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                tela: item.Tela,
                color: item.Color,
                lot: selectedLot,
                transferRolls: selectedTransferRolls.map(
                  (index) => availableTransferRolls[index].roll_number
                ),
              }),
            });

            const packingListResponseData = await response.json();
            console.log("📋 RESPUESTA PACKING LIST:", packingListResponseData);

            if (!response.ok) {
              if (
                response.status === 404 &&
                packingListResponseData.nonExistentRolls
              ) {
                throw new Error(
                  `Los rollos ${packingListResponseData.nonExistentRolls.join(
                    ", "
                  )} no existen en el packing list. Rollos disponibles: ${
                    packingListResponseData.availableRolls?.join(", ") ||
                    "ninguno"
                  }`
                );
              } else if (
                response.status === 400 &&
                packingListResponseData.rollsNotInCDMX
              ) {
                throw new Error(
                  `Los siguientes rollos no están en CDMX: ${packingListResponseData.rollsNotInCDMX
                    .map(
                      (r: { roll_number: string; current_location: string }) =>
                        `#${r.roll_number} (${r.current_location})`
                    )
                    .join(", ")}`
                );
              } else {
                throw new Error(
                  packingListResponseData.error ||
                    "Error al actualizar el packing list en el servidor"
                );
              }
            }

            await loadTransferPackingListData(item.Tela, item.Color, item.OC);
            packingListUpdateSuccess = true;
          } catch (error) {
            console.error("❌ ERROR AL ACTUALIZAR PACKING LIST:", error);
            toast.warning(
              `Traslado completado, pero error en packing list: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            packingListUpdateSuccess = false;
          }
        } else {
          packingListUpdateSuccess = true;
        }

        if (!inventoryUpdateSuccess) {
          toast.error("❌ Error completo: no se pudo completar el traslado");
        } else if (transferMode === "rolls" && !packingListUpdateSuccess) {
          toast.warning(
            "⚠️ Traslado completado con consolidación, pero con errores en packing list."
          );
        } else if (transferMode === "rolls" && packingListUpdateSuccess) {
          toast.success("Traslado realizado exitosamente.");
        }

        setOpenTransferDialog(false);

        console.log("🏁 TRASLADO CON CONSOLIDACIÓN COMPLETADO:", {
          inventoryUpdateSuccess,
          packingListUpdateSuccess,
          quantityTransferred: quantityToTransfer,
          operationType: updatePayload.transferType,
        });
      } finally {
        setIsProcessingTransfer(false);
      }
    }
  };

  const generateFileName = (): string => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
    const timeStr = `${now.getHours().toString().padStart(2, "0")}${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    let baseFileName = isAdmin ? "inventario" : "inventario_resumido";

    if (!isCurrentMonthAndYear()) {
      baseFileName += `_${getMonthName(
        currentViewingMonth
      ).toLowerCase()}_${currentViewingYear}`;
    }

    const filterParts: string[] = [];

    if (searchTerm) {
      filterParts.push(
        `busqueda_${searchTerm.replace(/\s+/g, "_").toLowerCase()}`
      );
    }

    if (unitFilter !== "all") {
      filterParts.push(`${unitFilter.toLowerCase()}`);
    }

    if (isAdmin && ocFilter !== "all") {
      filterParts.push(`oc_${ocFilter.replace(/[\s-]/g, "_").toLowerCase()}`);
    }

    if (telaFilter !== "all") {
      filterParts.push(`tela_${telaFilter.replace(/\s+/g, "_").toLowerCase()}`);
    }

    if (colorFilter !== "all") {
      filterParts.push(
        `color_${colorFilter.replace(/\s+/g, "_").toLowerCase()}`
      );
    }

    if (ubicacionFilter !== "all") {
      filterParts.push(`ubicacion_${ubicacionFilter.toLowerCase()}`);
    }

    let fileName = baseFileName;

    if (filterParts.length > 0) {
      fileName += `_filtrado_${filterParts.join("_")}`;
    }

    fileName += `_${dateStr}_${timeStr}`;

    return fileName;
  };

  const handleExportCSV = () => {
    let csvData;

    if (isAdmin) {
      csvData = Papa.unparse(inventory);
    } else {
      const filteredData = inventory.map((item) => ({
        Tela: item.Tela,
        Color: item.Color,
        Cantidad: item.Cantidad,
        Unidades: item.Unidades,
      }));

      csvData = Papa.unparse(filteredData);
    }

    const fileName = generateFileName();

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.csv`;
    link.click();
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const title = isAdmin ? "Inventario Completo" : "Inventario Resumido";
      doc.setFontSize(18);
      doc.text(title, 14, 22);

      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(
        now.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}/${now.getFullYear()}`;
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      doc.setFontSize(11);
      doc.text(`Fecha: ${dateStr} ${timeStr}`, 14, 30);

      let columns = [];
      let rows = [];

      if (isAdmin) {
        columns = [
          { header: "OC", dataKey: "OC" },
          { header: "Tela", dataKey: "Tela" },
          { header: "Color", dataKey: "Color" },
          { header: "Costo", dataKey: "Costo" },
          { header: "Cantidad", dataKey: "Cantidad" },
          { header: "Unidades", dataKey: "Unidades" },
          { header: "Total", dataKey: "Total" },
          { header: "Ubicación", dataKey: "Ubicacion" },
          { header: "Importación", dataKey: "Importacion" },
        ];

        rows = filteredInventory.map((item) => [
          item.OC,
          item.Tela,
          item.Color,
          `$${formatNumber(item.Costo)}`,
          formatNumber(item.Cantidad),
          item.Unidades,
          `$${formatNumber(item.Total)}`,
          item.Ubicacion || "-",
          item.Importacion,
        ]);

        rows.push([
          "TOTAL",
          "",
          "",
          "",
          formatNumber(totalCantidad),
          "",
          `$${formatNumber(totalCosto)}`,
          "",
          "",
        ]);
      } else {
        columns = [
          { header: "Tela", dataKey: "Tela" },
          { header: "Color", dataKey: "Color" },
          { header: "Cantidad", dataKey: "Cantidad" },
          { header: "Unidades", dataKey: "Unidades" },
          { header: "Ubicación", dataKey: "Ubicacion" },
        ];

        rows = filteredInventory.map((item) => [
          item.Tela,
          item.Color,
          formatNumber(item.Cantidad),
          item.Unidades,
          item.Ubicacion || "-",
        ]);

        rows.push(["TOTAL", "", formatNumber(totalCantidad), "", ""]);
      }

      autoTable(doc, {
        startY: 40,
        head: [columns.map((col) => col.header)],
        body: rows,
        theme: "striped",
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        footStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        didDrawCell: (data) => {
          if (data.section === "body" && data.row.index === rows.length - 1) {
            doc.setFillColor(240, 240, 240);
            doc.setFont("helvetica", "bold");
          }
        },
      });

      if (isFilterActive) {
        let yPos = 180;
        doc.setFontSize(10);
        doc.text("Filtros aplicados:", 14, yPos);
        yPos += 5;

        if (searchTerm !== "") {
          doc.text(`Búsqueda: "${searchTerm}"`, 20, yPos);
          yPos += 5;
        }
        if (unitFilter !== "all") {
          doc.text(`Unidades: ${unitFilter}`, 20, yPos);
          yPos += 5;
        }
        if (isAdmin && ocFilter !== "all") {
          doc.text(`OC: ${ocFilter}`, 20, yPos);
          yPos += 5;
        }
        if (telaFilter !== "all") {
          doc.text(`Tela: ${telaFilter}`, 20, yPos);
          yPos += 5;
        }
        if (colorFilter !== "all") {
          doc.text(`Color: ${colorFilter}`, 20, yPos);
          yPos += 5;
        }
        if (ubicacionFilter !== "all") {
          doc.text(`Ubicación: ${ubicacionFilter}`, 20, yPos);
        }
      }

      const fileName = generateFileName();
      doc.save(`${fileName}.pdf`);

      toast.success("PDF exportado exitosamente");
    } catch (error) {
      console.error("Error al exportar a PDF:", error);
      toast.error("Ocurrió un error al exportar a PDF");
    }
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

  const handleLoadHistoricalInventory = async (year: string, month: string) => {
    try {
      if (onLoadingChange) {
        onLoadingChange(true);
      }

      setIsLoadingHistorical(true);
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

      setCurrentViewingYear(year);
      setCurrentViewingMonth(month);

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
      setIsLoadingHistorical(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  const filteredInventoryForOC = useMemo(
    () =>
      inventory.filter((item) => {
        const searchTermLower = searchTerm.trim().toLowerCase();
        const isMaikyExactSearch = searchTermLower === "maiky";

        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTermLower) ||
            (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower)
          : (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower);

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;

        const matchesTela = telaFilter === "all" || item.Tela === telaFilter;

        const matchesColor =
          colorFilter === "all" || item.Color === colorFilter;

        const matchesUbicacion =
          ubicacionFilter === "all" || item.Ubicacion === ubicacionFilter;

        return (
          matchesSearch &&
          matchesUnit &&
          matchesTela &&
          matchesColor &&
          matchesUbicacion
        );
      }),
    [
      inventory,
      searchTerm,
      unitFilter,
      telaFilter,
      colorFilter,
      ubicacionFilter,
      isAdmin,
    ]
  );

  const filteredInventoryForTela = useMemo(
    () =>
      inventory.filter((item) => {
        const searchTermLower = searchTerm.trim().toLowerCase();
        const isMaikyExactSearch = searchTermLower === "maiky";

        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTermLower) ||
            (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower)
          : (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower);

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;

        const matchesOC = isAdmin
          ? ocFilter === "all" || item.OC === ocFilter
          : true;

        const matchesColor =
          colorFilter === "all" || item.Color === colorFilter;

        const matchesUbicacion =
          ubicacionFilter === "all" || item.Ubicacion === ubicacionFilter;

        return (
          matchesSearch &&
          matchesUnit &&
          matchesOC &&
          matchesColor &&
          matchesUbicacion
        );
      }),
    [
      inventory,
      searchTerm,
      unitFilter,
      ocFilter,
      colorFilter,
      ubicacionFilter,
      isAdmin,
    ]
  );

  const filteredInventoryForColor = useMemo(
    () =>
      inventory.filter((item) => {
        const searchTermLower = searchTerm.trim().toLowerCase();
        const isMaikyExactSearch = searchTermLower === "maiky";

        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTermLower) ||
            (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower)
          : (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower);

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;

        const matchesOC = isAdmin
          ? ocFilter === "all" || item.OC === ocFilter
          : true;

        const matchesTela = telaFilter === "all" || item.Tela === telaFilter;

        const matchesUbicacion =
          ubicacionFilter === "all" || item.Ubicacion === ubicacionFilter;

        return (
          matchesSearch &&
          matchesUnit &&
          matchesOC &&
          matchesTela &&
          matchesUbicacion
        );
      }),
    [
      inventory,
      searchTerm,
      unitFilter,
      ocFilter,
      telaFilter,
      ubicacionFilter,
      isAdmin,
    ]
  );

  const filteredInventoryForUbicacion = useMemo(
    () =>
      inventory.filter((item) => {
        const searchTermLower = searchTerm.trim().toLowerCase();
        const isMaikyExactSearch = searchTermLower === "maiky";

        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTermLower) ||
            (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower)
          : (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower);

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;

        const matchesOC = isAdmin
          ? ocFilter === "all" || item.OC === ocFilter
          : true;

        const matchesTela = telaFilter === "all" || item.Tela === telaFilter;

        const matchesColor =
          colorFilter === "all" || item.Color === colorFilter;

        return (
          matchesSearch &&
          matchesUnit &&
          matchesOC &&
          matchesTela &&
          matchesColor
        );
      }),
    [
      inventory,
      searchTerm,
      unitFilter,
      ocFilter,
      telaFilter,
      colorFilter,
      isAdmin,
    ]
  );

  const uniqueOCs = useMemo(
    () =>
      Array.from(new Set(filteredInventoryForOC.map((item) => item.OC)))
        .filter((oc) => oc !== "")
        .sort(),
    [filteredInventoryForOC]
  );

  const uniqueTelas = useMemo(
    () =>
      Array.from(new Set(filteredInventoryForTela.map((item) => item.Tela)))
        .filter((tela) => tela !== "" && tela != null)
        .sort(),
    [filteredInventoryForTela]
  );

  const uniqueColors = useMemo(
    () =>
      Array.from(new Set(filteredInventoryForColor.map((item) => item.Color)))
        .filter((color) => color !== "" && color != null)
        .sort(),
    [filteredInventoryForColor]
  );

  const uniqueUbicaciones = useMemo(
    () =>
      Array.from(
        new Set(filteredInventoryForUbicacion.map((item) => item.Ubicacion))
      )
        .filter((ubicacion) => ubicacion !== "" && ubicacion != null)
        .sort(),
    [filteredInventoryForUbicacion]
  );

  useEffect(() => {
    if (ocFilter !== "all" && !uniqueOCs.includes(ocFilter)) {
      setOcFilter("all");
    }
  }, [uniqueOCs, ocFilter, setOcFilter]);

  useEffect(() => {
    if (telaFilter !== "all" && !uniqueTelas.includes(telaFilter)) {
      setTelaFilter("all");
    }
  }, [uniqueTelas, telaFilter, setTelaFilter]);

  useEffect(() => {
    if (colorFilter !== "all" && !uniqueColors.includes(colorFilter)) {
      setColorFilter("all");
    }
  }, [uniqueColors, colorFilter, setColorFilter]);

  useEffect(() => {
    if (
      ubicacionFilter !== "all" &&
      !uniqueUbicaciones.includes(ubicacionFilter)
    ) {
      setUbicacionFilter("all");
    }
  }, [uniqueUbicaciones, ubicacionFilter, setUbicacionFilter]);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");

    setCurrentViewingYear(currentYear);
    setCurrentViewingMonth(currentMonth);
  }, []);

  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const searchTermLower = searchTerm.trim().toLowerCase();
        const isMaikyExactSearch = searchTermLower === "maiky";

        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTermLower) ||
            (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower)
          : (isMaikyExactSearch
              ? item.Tela.toLowerCase() === "maiky"
              : item.Tela.toLowerCase().includes(searchTermLower)) ||
            item.Color.toLowerCase().includes(searchTermLower);

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;

        const matchesOC = isAdmin
          ? ocFilter === "all" || item.OC === ocFilter
          : true;

        const matchesTela = telaFilter === "all" || item.Tela === telaFilter;

        const matchesColor =
          colorFilter === "all" || item.Color === colorFilter;

        const matchesUbicacion =
          ubicacionFilter === "all" || item.Ubicacion === ubicacionFilter;

        const hasQuantity = item.Cantidad > 0;

        return (
          matchesSearch &&
          matchesUnit &&
          matchesOC &&
          matchesTela &&
          matchesColor &&
          matchesUbicacion &&
          hasQuantity
        );
      }),
    [
      inventory,
      searchTerm,
      unitFilter,
      ocFilter,
      telaFilter,
      colorFilter,
      ubicacionFilter,
      isAdmin,
    ]
  );

  const totalCantidad = useMemo(() => {
    return filteredInventory.reduce((total, item) => total + item.Cantidad, 0);
  }, [filteredInventory]);

  const totalCosto = useMemo(() => {
    return filteredInventory.reduce((total, item) => total + item.Total, 0);
  }, [filteredInventory]);

  const activeProductsCount = useMemo(
    () => inventory.filter((item) => item.Cantidad > 0).length,
    [inventory]
  );

  const hasOCOptions = uniqueOCs.length > 0;
  const hasTelaOptions = uniqueTelas.length > 0;
  const hasColorOptions = uniqueColors.length > 0;
  const hasUbicacionOptions = uniqueUbicaciones.length > 0;

  return (
    <TooltipProvider>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <BoxIcon className="mr-2 h-5 w-5" />
                <div className="flex flex-col">
                  <span>Inventario</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground">
                      {getMonthName(currentViewingMonth)} {currentViewingYear}
                    </span>
                    {!isCurrentMonthAndYear() && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-amber-600 font-medium">
                          Vista Histórica
                        </span>
                      </div>
                    )}
                    {isCurrentMonthAndYear() && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600 font-medium">
                          Actual
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardTitle>
            <CardDescription>
              {activeProductsCount} productos en el sistema
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {isFilterActive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={resetAllFilters}>
                    <XCircleIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Limpiar filtros</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpenHistoryDialog(true)}
                  >
                    <HistoryIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cargar datos históricos</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleOpenReturnsDialog}
                  >
                    <UndoIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Procesar Devoluciones</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <DownloadIcon className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleExportCSV}>
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF}>
                      Exportar PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent>
                <p>Exportar datos</p>
              </TooltipContent>
            </Tooltip>

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-block">
                    <Button
                      variant="default"
                      size="icon"
                      className="bg-black hover:bg-gray-800 rounded-full"
                      onClick={handleOpenInventoryDialog}
                      disabled={!isCurrentMonthAndYear()}
                    >
                      <PlusIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isCurrentMonthAndYear()
                      ? "Agregar Rollos"
                      : `Bloqueado - Solo disponible en el mes actual. Actualmente viendo: ${getMonthName(
                          currentViewingMonth
                        )} ${currentViewingYear}`}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleInventoryCollapsed}
                >
                  {inventoryCollapsed ? (
                    <ChevronDownIcon className="h-5 w-5" />
                  ) : (
                    <ChevronUpIcon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{inventoryCollapsed ? "Expandir" : "Colapsar"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        {!inventoryCollapsed && (
          <>
            <CardContent className="pt-0 pb-4">
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="search">Buscar</Label>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-gray-400" />
                      </div>
                      <Input
                        id="search"
                        type="text"
                        placeholder={
                          isAdmin
                            ? "Buscar por OC, Tela, o Color"
                            : "Buscar por Tela o Color"
                        }
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setSearchTerm(e.target.value)
                        }
                        className="pl-10 w-full h-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="min-w-[150px] max-w-[150px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="unitFilter">Unidades</Label>
                    </div>
                    <Select
                      value={unitFilter}
                      onValueChange={(value) =>
                        setUnitFilter(value as UnitType | "all")
                      }
                    >
                      <SelectTrigger
                        id="unitFilter"
                        className="w-full truncate"
                      >
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="MTS">MTS</SelectItem>
                        <SelectItem value="KGS">KGS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isAdmin && (
                  <div className="min-w-[150px] max-w-[150px]">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="ocFilter">OC</Label>
                        {!hasOCOptions && ocFilter !== "all" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <AlertCircle
                                  size={14}
                                  className="text-amber-500"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                No hay OCs disponibles con los filtros actuales
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <Select value={ocFilter} onValueChange={setOcFilter}>
                        <SelectTrigger
                          id="ocFilter"
                          className="w-full truncate"
                        >
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {uniqueOCs.map((oc) => (
                            <SelectItem key={oc} value={oc}>
                              {oc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="min-w-[150px] max-w-[150px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="telaFilter">Tela</Label>
                      {!hasTelaOptions && telaFilter !== "all" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <AlertCircle
                                size={14}
                                className="text-amber-500"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              No hay telas disponibles con los filtros actuales
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Select value={telaFilter} onValueChange={setTelaFilter}>
                      <SelectTrigger
                        id="telaFilter"
                        className="w-full truncate"
                      >
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {uniqueTelas.map((tela) => (
                          <SelectItem key={tela} value={tela}>
                            {tela}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="min-w-[150px] max-w-[150px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="colorFilter">Color</Label>
                      {!hasColorOptions && colorFilter !== "all" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <AlertCircle
                                size={14}
                                className="text-amber-500"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              No hay colores disponibles con los filtros
                              actuales
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Select value={colorFilter} onValueChange={setColorFilter}>
                      <SelectTrigger
                        id="colorFilter"
                        className="w-full truncate"
                      >
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {uniqueColors.map((color) => (
                          <SelectItem key={color} value={color}>
                            {color}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="min-w-[150px] max-w-[150px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="ubicacionFilter">Ubicación</Label>
                      {!hasUbicacionOptions && ubicacionFilter !== "all" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <AlertCircle
                                size={14}
                                className="text-amber-500"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              No hay ubicaciones disponibles con los filtros
                              actuales
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Select
                      value={ubicacionFilter}
                      onValueChange={setUbicacionFilter}
                    >
                      <SelectTrigger
                        id="ubicacionFilter"
                        className="w-full truncate"
                      >
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="CDMX">CDMX</SelectItem>
                        <SelectItem value="Mérida">Mérida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Filter size={16} className="text-gray-500" />
                <span className="text-gray-500">Filtros activos:</span>
                <div className="flex flex-wrap gap-2">
                  {ocFilter && ocFilter !== "all" && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      OC: {ocFilter}
                    </span>
                  )}
                  {telaFilter && telaFilter !== "all" && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                      Tela: {telaFilter}
                    </span>
                  )}
                  {colorFilter && colorFilter !== "all" && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                      Color: {colorFilter}
                    </span>
                  )}
                  {ubicacionFilter && ubicacionFilter !== "all" && (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                      Ubicación: {ubicacionFilter}
                    </span>
                  )}
                  {unitFilter && unitFilter !== "all" && (
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                      Unidades: {unitFilter}
                    </span>
                  )}
                  {searchTerm && (
                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
                      Búsqueda: {searchTerm}
                    </span>
                  )}
                  {(!ocFilter || ocFilter === "all") &&
                    (!telaFilter || telaFilter === "all") &&
                    (!colorFilter || colorFilter === "all") &&
                    (!ubicacionFilter || ubicacionFilter === "all") &&
                    (!unitFilter || unitFilter === "all") &&
                    !searchTerm && (
                      <span className="text-gray-500">Ninguno</span>
                    )}
                </div>
              </div>
            </CardContent>

            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <div className="h-[500px] overflow-auto relative">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                      <tr>
                        {isAdmin && (
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                            OC
                          </th>
                        )}
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                          Tela
                        </th>
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                          Color
                        </th>
                        {isAdmin && (
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                            Costo
                          </th>
                        )}
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                          Cantidad
                        </th>
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                          Unidades
                        </th>
                        {isAdmin && (
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                            Total
                          </th>
                        )}
                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                          Ubicación
                        </th>
                        {isAdmin && (
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                            Importación
                          </th>
                        )}
                        {isAdmin && (
                          <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b">
                            Acciones
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr className="h-[500px]">
                          <td
                            colSpan={isAdmin ? 10 : 5}
                            className="p-2 align-middle text-center"
                          >
                            <div className="flex justify-center items-center">
                              <Loader2Icon className="h-8 w-8 animate-spin text-gray-500" />
                              <span className="ml-2">
                                Cargando inventario...
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredInventory.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isAdmin ? 10 : 5}
                            className="relative p-0"
                          >
                            <div className="min-h-[50vh] relative">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-gray-500">
                                  No hay datos disponibles
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredInventory.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            {isAdmin && (
                              <td className="p-2 align-middle">{item.OC}</td>
                            )}
                            <td className="p-2 align-middle">{item.Tela}</td>
                            <td className="p-2 align-middle">{item.Color}</td>
                            {isAdmin && (
                              <td className="p-2 align-middle">
                                ${formatNumber(item.Costo)}
                              </td>
                            )}
                            <td className="p-2 align-middle">
                              {formatNumber(item.Cantidad)}
                            </td>
                            <td className="p-2 align-middle">
                              {item.Unidades}
                            </td>
                            {isAdmin && (
                              <td className="p-2 align-middle">
                                ${formatNumber(item.Total)}
                              </td>
                            )}
                            <td className="p-2 align-middle">
                              {item.Ubicacion || "-"}
                            </td>
                            {isAdmin && (
                              <td className="p-2 align-middle">
                                {item.Importacion}
                              </td>
                            )}
                            {isAdmin && (
                              <td className="p-2 align-middle">
                                <div className="flex space-x-2">
                                  {/* Botón Editar */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="inline-block">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleOpenEditDialog(item)
                                          }
                                          disabled={!isCurrentMonthAndYear()}
                                          className={
                                            !isCurrentMonthAndYear()
                                              ? "pointer-events-none"
                                              : ""
                                          }
                                        >
                                          <PencilIcon className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {isCurrentMonthAndYear()
                                          ? "Editar"
                                          : `Bloqueado - Solo disponible en el mes actual. Actualmente viendo: ${getMonthName(
                                              currentViewingMonth
                                            )} ${currentViewingYear}`}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>

                                  {/* Botón Vender */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="inline-block">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleOpenSellDialog(item)
                                          }
                                          disabled={!isCurrentMonthAndYear()}
                                          className={
                                            !isCurrentMonthAndYear()
                                              ? "pointer-events-none"
                                              : ""
                                          }
                                        >
                                          <DollarSign className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {isCurrentMonthAndYear()
                                          ? "Vender"
                                          : `Bloqueado - Solo disponible en el mes actual. Actualmente viendo: ${getMonthName(
                                              currentViewingMonth
                                            )} ${currentViewingYear}`}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>

                                  {/* Botón Trasladar */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="inline-block">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleOpenTransferDialog(item)
                                          }
                                          disabled={
                                            item.Ubicacion !== "CDMX" ||
                                            !isCurrentMonthAndYear()
                                          }
                                          className={
                                            item.Ubicacion !== "CDMX" ||
                                            !isCurrentMonthAndYear()
                                              ? "pointer-events-none"
                                              : ""
                                          }
                                        >
                                          <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                            />
                                          </svg>
                                        </Button>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {!isCurrentMonthAndYear()
                                          ? `Bloqueado - Solo disponible en el mes actual. Actualmente viendo: ${getMonthName(
                                              currentViewingMonth
                                            )} ${currentViewingYear}`
                                          : item.Ubicacion !== "CDMX"
                                            ? "Solo desde CDMX"
                                            : "Trasladar a Mérida"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {!isLoading && filteredInventory.length > 0 && (
                      <tfoot className="bg-muted sticky bottom-0 z-10">
                        <tr>
                          {isAdmin && (
                            <td
                              colSpan={3}
                              className="p-2 align-middle font-bold"
                            >
                              Total
                            </td>
                          )}
                          {!isAdmin && (
                            <td
                              colSpan={2}
                              className="p-2 align-middle font-bold"
                            >
                              Total
                            </td>
                          )}
                          {isAdmin && <td className="p-2 align-middle"></td>}
                          <td className="p-2 align-middle font-bold">
                            {formatNumber(totalCantidad)}
                          </td>
                          <td className="p-2 align-middle"></td>
                          {isAdmin && (
                            <td className="p-2 align-middle font-bold">
                              ${formatNumber(totalCosto)}
                            </td>
                          )}
                          <td className="p-2 align-middle"></td>
                          {isAdmin && <td className="p-2 align-middle"></td>}
                          {isAdmin && <td className="p-2 align-middle"></td>}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </CardContent>
          </>
        )}

        <Dialog
          open={openInventoryDialog}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseInventoryDialog();
            } else {
              setOpenInventoryDialog(true);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <PlusIcon className="mr-2 h-5 w-5" />
                Agregar Inventario
              </DialogTitle>
              <DialogDescription>
                Sube un archivo packing list o crea una nueva entrada de
                inventario manualmente.
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="packing-list">
                  Subir Packing List
                </TabsTrigger>
                <TabsTrigger value="manual-row">Nueva Row Manual</TabsTrigger>
              </TabsList>

              <TabsContent value="packing-list" className="space-y-4">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <FolderOpenIcon className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="mb-4 text-sm text-gray-500 text-center">
                    Selecciona un archivo Excel con la información del Packing
                    List
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
              </TabsContent>

              <TabsContent value="manual-row" className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="oc" className="text-right">
                      OC *
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="oc"
                        placeholder="Ej: Dsma-03-23-Slm1-Pqp1"
                        value={formData.OC}
                        onChange={(e) =>
                          handleInputChange("OC", e.target.value)
                        }
                        className={
                          formErrors.OC && touchedFields.OC
                            ? "border-red-500"
                            : ""
                        }
                      />
                      {formErrors.OC && touchedFields.OC && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.OC}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tela" className="text-right">
                      Tela *
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="tela"
                        placeholder="Ej: Slim, Maiky Plus, etc."
                        value={formData.Tela}
                        onChange={(e) =>
                          handleInputChange("Tela", e.target.value)
                        }
                        className={
                          formErrors.Tela && touchedFields.Tela
                            ? "border-red-500"
                            : ""
                        }
                      />
                      {formErrors.Tela && touchedFields.Tela && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.Tela}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="color" className="text-right">
                      Color *
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="color"
                        placeholder="Ej: Rojo, Negro, Azul, etc."
                        value={formData.Color}
                        onChange={(e) =>
                          handleInputChange("Color", e.target.value)
                        }
                        className={
                          formErrors.Color && touchedFields.Color
                            ? "border-red-500"
                            : ""
                        }
                      />
                      {formErrors.Color && touchedFields.Color && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.Color}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ubicacion" className="text-right">
                      Ubicación *
                    </Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.Ubicacion}
                        onValueChange={(value) =>
                          handleInputChange("Ubicacion", value)
                        }
                      >
                        <SelectTrigger
                          className={
                            formErrors.Ubicacion && touchedFields.Ubicacion
                              ? "border-red-500"
                              : ""
                          }
                        >
                          <SelectValue placeholder="Selecciona ubicación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CDMX">CDMX</SelectItem>
                          <SelectItem value="Mérida">Mérida</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.Ubicacion && touchedFields.Ubicacion && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.Ubicacion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="cantidad" className="text-right">
                      Cantidad *
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="cantidad"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Ej: 100.5"
                        value={formData.Cantidad}
                        onChange={(e) =>
                          handleInputChange("Cantidad", e.target.value)
                        }
                        className={
                          formErrors.Cantidad && touchedFields.Cantidad
                            ? "border-red-500"
                            : ""
                        }
                      />
                      {formErrors.Cantidad && touchedFields.Cantidad && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.Cantidad}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="costo" className="text-right">
                      Costo *
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="costo"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ej: 77.50"
                        value={formData.Costo}
                        onChange={(e) =>
                          handleInputChange("Costo", e.target.value)
                        }
                        className={
                          formErrors.Costo && touchedFields.Costo
                            ? "border-red-500"
                            : ""
                        }
                      />
                      {formErrors.Costo && touchedFields.Costo && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.Costo}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unidades" className="text-right">
                      Unidades *
                    </Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.Unidades}
                        onValueChange={(value: "KGS" | "MTS") =>
                          handleInputChange("Unidades", value)
                        }
                      >
                        <SelectTrigger
                          className={
                            formErrors.Unidades && touchedFields.Unidades
                              ? "border-red-500"
                              : ""
                          }
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KGS">KGS</SelectItem>
                          <SelectItem value="MTS">MTS</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.Unidades && touchedFields.Unidades && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.Unidades}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="importacion" className="text-right">
                      Importación
                    </Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.Importacion}
                        onValueChange={(value) =>
                          handleInputChange("Importacion", value)
                        }
                      >
                        <SelectTrigger
                          className={
                            formErrors.Importacion && touchedFields.Importacion
                              ? "border-red-500"
                              : ""
                          }
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DA">DA</SelectItem>
                          <SelectItem value="HOY">HOY</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.Importacion && touchedFields.Importacion && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.Importacion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenInventoryDialog(false)}
                disabled={isUploading || isCreatingRow}
              >
                Cerrar
              </Button>
              {activeTab === "manual-row" && (
                <Button
                  onClick={handleCreateRow}
                  disabled={isCreatingRow}
                  className="flex items-center gap-2"
                >
                  {isCreatingRow ? (
                    <>
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      Crear Row
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openHistoryDialog} onOpenChange={setOpenHistoryDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <HistoryIcon className="mr-2 h-5 w-5" />
                Cargar Inventario Histórico
              </DialogTitle>
              <DialogDescription>
                Selecciona el año y mes del inventario que deseas cargar desde
                S3.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="year" className="text-right">
                  Año
                </Label>
                <Select
                  value={selectedHistoryYear}
                  onValueChange={setSelectedHistoryYear}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona año" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableYears().map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="month" className="text-right">
                  Mes
                </Label>
                <Select
                  value={selectedHistoryMonth}
                  onValueChange={setSelectedHistoryMonth}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
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
                    ].map((month) => {
                      const now = new Date();
                      const currentYear = now.getFullYear();
                      const currentMonth = now.getMonth() + 1;
                      const selectedYear = parseInt(selectedHistoryYear);
                      const monthNum = parseInt(month.value);

                      const isFuture =
                        selectedYear > currentYear ||
                        (selectedYear === currentYear &&
                          monthNum > currentMonth);

                      return (
                        <SelectItem
                          key={month.value}
                          value={month.value}
                          disabled={isFuture}
                        >
                          {month.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenHistoryDialog(false)}
                disabled={isLoadingHistorical}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  handleLoadHistoricalInventory(
                    selectedHistoryYear,
                    selectedHistoryMonth
                  );
                  setOpenHistoryDialog(false);
                }}
                disabled={isLoadingHistorical}
                className="flex items-center gap-2"
              >
                {isLoadingHistorical ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <HistoryIcon className="h-4 w-4" />
                    Cargar Inventario
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openSellDialog} onOpenChange={setOpenSellDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vender Producto</DialogTitle>
              <DialogDescription>
                {selectedItemIndex !== null &&
                  `${inventory[selectedItemIndex]?.Tela} ${inventory[selectedItemIndex]?.Color}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex gap-4">
                <Button
                  variant={sellMode === "manual" ? "default" : "outline"}
                  onClick={() => setSellMode("manual")}
                  className="flex-1"
                >
                  <Input className="mr-2 h-4 w-4" />
                  Cantidad Manual
                </Button>
                <Button
                  variant={sellMode === "rolls" ? "default" : "outline"}
                  onClick={() => setSellMode("rolls")}
                  className="flex-1"
                >
                  <BoxIcon className="mr-2 h-4 w-4" />
                  Por Rollos Específicos
                </Button>
              </div>

              {sellMode === "manual" ? (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="quantity" className="text-right">
                    Cantidad
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      quantityToUpdate === 0 ? "" : quantityToUpdate.toString()
                    }
                    onChange={(e) => {
                      const numericValue = parseFloat(e.target.value) || 0;
                      setQuantityToUpdate(numericValue);
                    }}
                    placeholder="0.00"
                    className="col-span-3"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {isLoadingPackingList ? (
                    <div className="flex justify-center py-8">
                      <Loader2Icon className="h-8 w-8 animate-spin" />
                    </div>
                  ) : availableRolls.length > 0 ? (
                    <>
                      {availableLots.length > 1 && (
                        <div className="space-y-2">
                          <Label>Seleccionar Lote</Label>
                          <Select
                            value={selectedLot?.toString()}
                            onValueChange={(value) =>
                              handleLotChange(Number(value))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un lote" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableLots.map((lot) => (
                                <SelectItem key={lot} value={lot.toString()}>
                                  Lote {lot} (
                                  {rollsGroupedByLot.get(lot)?.length || 0}{" "}
                                  rollos)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="text-sm text-gray-600">
                        Lote: {selectedLot} - {availableRolls.length} rollos
                        disponibles
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedRolls(availableRolls.map((_, i) => i))
                          }
                        >
                          Todos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRolls([])}
                        >
                          Limpiar
                        </Button>
                      </div>

                      <div className="border rounded-lg max-h-60 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="p-1 text-left text-sm">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedRolls.length ===
                                      availableRolls.length &&
                                    availableRolls.length > 0
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRolls(
                                        availableRolls.map((_, i) => i)
                                      );
                                    } else {
                                      setSelectedRolls([]);
                                    }
                                  }}
                                />
                              </th>
                              <th className="p-1 text-left text-sm">Rollo #</th>
                              <th className="p-1 text-left text-sm">Almacén</th>
                              <th className="p-1 text-left text-sm">
                                {availableRolls[0]?.kg !== undefined
                                  ? "Peso (kg)"
                                  : "Metros"}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {availableRolls.map((roll, index) => (
                              <tr
                                key={`${selectedLot}-${roll.roll_number}-${index}`}
                                className={`border-b hover:bg-gray-50 cursor-pointer ${
                                  selectedRolls.includes(index)
                                    ? "bg-blue-50"
                                    : ""
                                }`}
                                onClick={() => handleRollSelection(index)}
                              >
                                <td
                                  className="p-1 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRolls.includes(index)}
                                    onChange={() => handleRollSelection(index)}
                                  />
                                </td>
                                <td className="p-1 text-sm">
                                  {roll.roll_number}
                                </td>
                                <td className="p-1 text-sm">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${
                                      roll.almacen === "CDMX"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {roll.almacen}
                                  </span>
                                </td>
                                <td className="p-1 text-sm font-medium">
                                  {roll.kg !== undefined
                                    ? `${roll.kg} kg`
                                    : `${roll.mts} mts`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 sticky bottom-0">
                            <tr>
                              <td
                                colSpan={3}
                                className="p-1 text-right font-medium text-sm"
                              >
                                Total seleccionado:
                              </td>
                              <td className="p-1 font-bold text-sm">
                                {calculateTotalFromRolls().toFixed(2)}{" "}
                                {availableRolls[0]?.kg !== undefined
                                  ? "kg"
                                  : "mts"}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="bg-blue-50 p-2 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">
                            Resumen de venta:
                          </span>
                          <span className="text-lg font-bold">
                            {calculateTotalFromRolls().toFixed(2)}{" "}
                            {selectedItemIndex !== null &&
                              inventory[selectedItemIndex]?.Unidades}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {selectedRolls.length} rollo(s) seleccionado(s) del
                          lote {selectedLot}
                        </div>
                        {selectedItemIndex !== null && (
                          <div className="text-sm mt-2">
                            <span className="text-gray-600">
                              Quedará en inventario:{" "}
                            </span>
                            <span className="font-medium">
                              {(
                                inventory[selectedItemIndex].Cantidad -
                                calculateTotalFromRolls()
                              ).toFixed(2)}{" "}
                              {inventory[selectedItemIndex].Unidades}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : packingListData.length > 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>
                        No se encontraron rollos disponibles para esta tela y
                        color.
                      </p>
                      <p className="text-sm mt-2">
                        Es posible que todos los rollos hayan sido vendidos.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FolderOpenIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>
                        No se encontró información de rollos para este producto.
                      </p>
                      <p className="text-sm mt-2">
                        Verifique que exista un packing list cargado para esta
                        tela.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedItemIndex !== null && (
                <div className="text-sm text-gray-500">
                  Inventario disponible:{" "}
                  {formatNumber(inventory[selectedItemIndex]?.Cantidad)}{" "}
                  {inventory[selectedItemIndex]?.Unidades}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenSellDialog(false)}
                disabled={isProcessingSell}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSellItem}
                disabled={
                  isProcessingSell ||
                  (sellMode === "manual" && quantityToUpdate <= 0) ||
                  (sellMode === "rolls" && selectedRolls.length === 0)
                }
                className="flex items-center gap-2"
              >
                {isProcessingSell ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Procesando Venta...
                  </>
                ) : (
                  "Confirmar Venta"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openTransferDialog} onOpenChange={setOpenTransferDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <svg
                  className="mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                Trasladar a Mérida
              </DialogTitle>
              <DialogDescription>
                {selectedItemIndex !== null &&
                  `${inventory[selectedItemIndex]?.Tela} ${inventory[selectedItemIndex]?.Color} (Desde CDMX)`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex gap-4">
                <Button
                  variant={transferMode === "manual" ? "default" : "outline"}
                  onClick={() => setTransferMode("manual")}
                  className="flex-1"
                >
                  <Input className="mr-2 h-4 w-4" />
                  Cantidad Manual
                </Button>
                <Button
                  variant={transferMode === "rolls" ? "default" : "outline"}
                  onClick={() => setTransferMode("rolls")}
                  className="flex-1"
                >
                  <BoxIcon className="mr-2 h-4 w-4" />
                  Por Rollos Específicos
                </Button>
              </div>

              {transferMode === "manual" ? (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="transfer-quantity" className="text-right">
                    Cantidad
                  </Label>
                  <Input
                    id="transfer-quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      quantityToUpdate === 0 ? "" : quantityToUpdate.toString()
                    }
                    onChange={(e) => {
                      const numericValue = parseFloat(e.target.value) || 0;
                      setQuantityToUpdate(numericValue);
                    }}
                    placeholder="0.00"
                    className="col-span-3"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {isLoadingTransferList ? (
                    <div className="flex justify-center py-8">
                      <Loader2Icon className="h-8 w-8 animate-spin" />
                    </div>
                  ) : availableTransferRolls.length > 0 ? (
                    <>
                      {availableLots.length > 1 && (
                        <div className="space-y-2">
                          <Label>Seleccionar Lote</Label>
                          <Select
                            value={selectedLot?.toString()}
                            onValueChange={(value) =>
                              handleLotChangeForTransfer(Number(value))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un lote" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableLots.map((lot) => {
                                const cdmxRolls =
                                  rollsGroupedByLot
                                    .get(lot)
                                    ?.filter(
                                      (roll) => roll.almacen === "CDMX"
                                    ) || [];
                                return cdmxRolls.length > 0 ? (
                                  <SelectItem key={lot} value={lot.toString()}>
                                    Lote {lot} ({cdmxRolls.length} rollos en
                                    CDMX)
                                  </SelectItem>
                                ) : null;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="text-sm text-gray-600">
                        Lote: {selectedLot} - {availableTransferRolls.length}{" "}
                        rollos disponibles en CDMX
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedTransferRolls(
                              availableTransferRolls.map((_, i) => i)
                            )
                          }
                        >
                          Todos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTransferRolls([])}
                        >
                          Limpiar
                        </Button>
                      </div>

                      <div className="border rounded-lg max-h-60 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="p-1 text-left text-sm">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedTransferRolls.length ===
                                      availableTransferRolls.length &&
                                    availableTransferRolls.length > 0
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTransferRolls(
                                        availableTransferRolls.map((_, i) => i)
                                      );
                                    } else {
                                      setSelectedTransferRolls([]);
                                    }
                                  }}
                                />
                              </th>
                              <th className="p-1 text-left text-sm">Rollo #</th>
                              <th className="p-1 text-left text-sm">Almacén</th>
                              <th className="p-1 text-left text-sm">
                                {availableTransferRolls[0]?.kg !== undefined
                                  ? "Peso (kg)"
                                  : "Metros"}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {availableTransferRolls.map((roll, index) => (
                              <tr
                                key={`transfer-${selectedLot}-${roll.roll_number}-${index}`}
                                className={`border-b hover:bg-gray-50 cursor-pointer ${
                                  selectedTransferRolls.includes(index)
                                    ? "bg-blue-50"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleTransferRollSelection(index)
                                }
                              >
                                <td
                                  className="p-1 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedTransferRolls.includes(
                                      index
                                    )}
                                    onChange={() =>
                                      handleTransferRollSelection(index)
                                    }
                                  />
                                </td>
                                <td className="p-1 text-sm">
                                  {roll.roll_number}
                                </td>
                                <td className="p-1 text-sm">
                                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                    {roll.almacen}
                                  </span>
                                </td>
                                <td className="p-1 text-sm font-medium">
                                  {roll.kg !== undefined
                                    ? `${roll.kg} kg`
                                    : `${roll.mts} mts`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 sticky bottom-0">
                            <tr>
                              <td
                                colSpan={3}
                                className="p-1 text-right font-medium text-sm"
                              >
                                Total a trasladar:
                              </td>
                              <td className="p-1 font-bold text-sm">
                                {calculateTotalFromTransferRolls().toFixed(2)}{" "}
                                {availableTransferRolls[0]?.kg !== undefined
                                  ? "kg"
                                  : "mts"}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="bg-green-50 p-2 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">
                            Resumen de traslado:
                          </span>
                          <span className="text-lg font-bold">
                            {calculateTotalFromTransferRolls().toFixed(2)}{" "}
                            {selectedItemIndex !== null &&
                              inventory[selectedItemIndex]?.Unidades}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {selectedTransferRolls.length} rollo(s)
                          seleccionado(s) del lote {selectedLot}
                        </div>
                        <div className="text-sm mt-2">
                          <span className="text-gray-600">
                            De CDMX → Mérida
                          </span>
                        </div>
                        {selectedItemIndex !== null && (
                          <div className="text-sm mt-1">
                            <span className="text-gray-600">
                              Quedará en CDMX:{" "}
                            </span>
                            <span className="font-medium">
                              {(
                                inventory[selectedItemIndex].Cantidad -
                                calculateTotalFromTransferRolls()
                              ).toFixed(2)}{" "}
                              {inventory[selectedItemIndex].Unidades}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>
                        No se encontraron rollos disponibles en CDMX para esta
                        tela y color.
                      </p>
                      <p className="text-sm mt-2">
                        Verifique que existan rollos en CDMX para trasladar a
                        Mérida.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedItemIndex !== null && (
                <div className="text-sm text-gray-500">
                  Inventario disponible en CDMX:{" "}
                  {formatNumber(inventory[selectedItemIndex]?.Cantidad)}{" "}
                  {inventory[selectedItemIndex]?.Unidades}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenTransferDialog(false)}
                disabled={isProcessingTransfer}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTransferItem}
                disabled={
                  isProcessingTransfer ||
                  (transferMode === "manual" && quantityToUpdate <= 0) ||
                  (transferMode === "rolls" &&
                    selectedTransferRolls.length === 0)
                }
                className="flex items-center gap-2"
              >
                {isProcessingTransfer ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar Traslado"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Inventario</DialogTitle>
              <DialogDescription>
                {selectedItemIndex !== null &&
                  `Ingrese la cantidad de ${inventory[selectedItemIndex]?.Tela} ${inventory[selectedItemIndex]?.Color} que desea agregar al inventario.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="add-quantity" className="text-right">
                  Cantidad
                </Label>
                <Input
                  id="add-quantity"
                  type="text"
                  value={
                    quantityToUpdate === 0
                      ? ""
                      : formatInputNumber(quantityToUpdate.toString())
                  }
                  onChange={(e) => {
                    const numericValue = parseInputNumber(e.target.value);
                    setQuantityToUpdate(numericValue);
                  }}
                  placeholder="0.00"
                  className="col-span-3"
                />
              </div>
              {selectedItemIndex !== null && (
                <div className="text-sm text-gray-500">
                  Inventario actual:{" "}
                  {formatNumber(inventory[selectedItemIndex]?.Cantidad)}{" "}
                  {inventory[selectedItemIndex]?.Unidades}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddItem}>Confirmar Adición</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Producto</DialogTitle>
            </DialogHeader>

            {editingItem && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-oc" className="text-right">
                    OC
                  </Label>
                  <Input
                    id="edit-oc"
                    value={editingItem.OC}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, OC: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-tela" className="text-right">
                    Tela
                  </Label>
                  <Input
                    id="edit-tela"
                    value={editingItem.Tela}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, Tela: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-color" className="text-right">
                    Color
                  </Label>
                  <Input
                    id="edit-color"
                    value={editingItem.Color}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, Color: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-costo" className="text-right">
                    Costo
                  </Label>
                  <Input
                    id="edit-costo"
                    type="number"
                    step="0.01"
                    value={editingItem.Costo}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        Costo: Number(e.target.value),
                      })
                    }
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-cantidad" className="text-right">
                    Cantidad
                  </Label>
                  <Input
                    id="edit-cantidad"
                    type="number"
                    step="0.01"
                    value={editingItem.Cantidad}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        Cantidad: Number(e.target.value),
                      })
                    }
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-unidades" className="text-right">
                    Unidades
                  </Label>
                  <Select
                    value={editingItem.Unidades}
                    onValueChange={(value) =>
                      setEditingItem({
                        ...editingItem,
                        Unidades: value as UnitType,
                      })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTS">MTS</SelectItem>
                      <SelectItem value="KGS">KGS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-ubicacion" className="text-right">
                    Ubicación
                  </Label>
                  <Select
                    value={editingItem.Ubicacion}
                    onValueChange={(value) =>
                      setEditingItem({ ...editingItem, Ubicacion: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CDMX">CDMX</SelectItem>
                      <SelectItem value="Mérida">Mérida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-importacion" className="text-right">
                    Importación
                  </Label>
                  <Select
                    value={editingItem.Importacion}
                    onValueChange={(value) =>
                      setEditingItem({
                        ...editingItem,
                        Importacion: value as "DA" | "HOY",
                      })
                    }
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
                  <Label className="text-right">Total</Label>
                  <div className="col-span-3 p-2 bg-gray-50 rounded">
                    ${formatNumber(editingItem.Costo * editingItem.Cantidad)}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenEditDialog(false)}
                disabled={isEditingInProgress}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditItem}
                disabled={isEditingInProgress}
                className="flex items-center gap-2"
              >
                {isEditingInProgress ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openReturnsDialog} onOpenChange={setOpenReturnsDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <UndoIcon className="mr-2 h-5 w-5" />
                Procesar Devoluciones
              </DialogTitle>
              <DialogDescription>
                Seleccione los rollos que desea devolver al inventario
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {isLoadingReturns ? (
                <div className="flex justify-center py-12">
                  <div className="flex flex-col items-center">
                    <Loader2Icon className="h-8 w-8 animate-spin text-gray-500 mb-3" />
                    <p className="text-gray-500">Cargando rollos vendidos...</p>
                  </div>
                </div>
              ) : availableSoldRolls.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Orden de Compra</Label>
                      <Select
                        value={selectedOCForReturns}
                        onValueChange={handleOCChangeForReturns}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una OC" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOCs.map((oc) => (
                            <SelectItem key={oc} value={oc}>
                              {oc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Lote (opcional)</Label>
                      <Select
                        value={selectedLotForReturns || "all"}
                        onValueChange={handleLotChangeForReturns}
                        disabled={!selectedOCForReturns}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos los lotes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los lotes</SelectItem>
                          {availableLotsForReturns.map((lot: number) => {
                            const rollsInLot =
                              groupedByOCAndLot[selectedOCForReturns]?.[
                                lot
                              ]?.filter(
                                (roll: ApiSoldRoll) => roll.available_for_return
                              )?.length || 0;

                            return (
                              <SelectItem key={lot} value={lot.toString()}>
                                Lote {lot} ({rollsInLot} rollos)
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedOCForReturns &&
                    getFilteredRollsForReturns().length > 0 && (
                      <>
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-blue-900">
                                OC: {selectedOCForReturns}
                                {selectedLotForReturns &&
                                  ` - Lote ${selectedLotForReturns}`}
                              </h3>
                              <p className="text-sm text-blue-700">
                                Rollos mostrados:{" "}
                                <span className="font-bold">
                                  {getFilteredRollsForReturns().length}
                                </span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-blue-700">
                                Seleccionados:{" "}
                                <span className="font-bold">
                                  {selectedReturnRolls.length}
                                </span>
                              </p>
                              <p className="text-xs text-blue-600">
                                Total:{" "}
                                {calculateTotalReturnQuantityFiltered().toFixed(
                                  2
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSelectedReturnRolls(
                                getFilteredRollsForReturns().map((_, i) => i)
                              )
                            }
                          >
                            Todos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReturnRolls([])}
                          >
                            Limpiar
                          </Button>
                        </div>

                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="p-2 text-left text-sm">
                                  <input
                                    type="checkbox"
                                    checked={
                                      selectedReturnRolls.length ===
                                        getFilteredRollsForReturns().length &&
                                      getFilteredRollsForReturns().length > 0
                                    }
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedReturnRolls(
                                          getFilteredRollsForReturns().map(
                                            (_, i) => i
                                          )
                                        );
                                      } else {
                                        setSelectedReturnRolls([]);
                                      }
                                    }}
                                  />
                                </th>
                                <th className="p-2 text-left font-medium">
                                  Rollo #
                                </th>
                                <th className="p-2 text-left font-medium">
                                  Lote
                                </th>
                                <th className="p-2 text-left font-medium">
                                  Tela
                                </th>
                                <th className="p-2 text-left font-medium">
                                  Color
                                </th>
                                <th className="p-2 text-left font-medium">
                                  Almacén
                                </th>
                                <th className="p-2 text-left font-medium">
                                  Cantidad
                                </th>
                                <th className="p-2 text-left font-medium">
                                  Fecha Venta
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {getFilteredRollsForReturns().map(
                                (roll, index) => (
                                  <tr
                                    key={`return-roll-${roll.roll_number}-${roll.lot}-${index}`}
                                    className={`border-b hover:bg-gray-50 cursor-pointer ${
                                      selectedReturnRolls.includes(index)
                                        ? "bg-blue-50"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      handleReturnRollSelectionFiltered(index)
                                    }
                                  >
                                    <td
                                      className="p-2 text-sm"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedReturnRolls.includes(
                                          index
                                        )}
                                        onChange={() =>
                                          handleReturnRollSelectionFiltered(
                                            index
                                          )
                                        }
                                      />
                                    </td>
                                    <td className="p-2 font-medium">
                                      {roll.sale_type === "manual" ? (
                                        <span className="flex items-center">
                                          #{roll.roll_number}
                                        </span>
                                      ) : (
                                        `#${roll.roll_number}`
                                      )}
                                    </td>
                                    <td className="p-2">
                                      {roll.lot === 0 ? (
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                          Manual
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                                          {roll.lot}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2">{roll.fabric_type}</td>
                                    <td className="p-2">{roll.color}</td>
                                    <td className="p-2">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs ${
                                          roll.almacen === "CDMX"
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-green-100 text-green-800"
                                        }`}
                                      >
                                        {roll.almacen}
                                      </span>
                                    </td>
                                    <td className="p-2 font-medium">
                                      {formatNumber(roll.sold_quantity)}{" "}
                                      {roll.units}
                                    </td>
                                    <td className="p-2 text-gray-600">
                                      {new Date(
                                        roll.sold_date
                                      ).toLocaleDateString("es-MX", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                            <tfoot className="bg-gray-50 sticky bottom-0">
                              <tr>
                                <td
                                  colSpan={6}
                                  className="p-2 text-right font-medium text-sm"
                                >
                                  Total a devolver:
                                </td>
                                <td className="p-2 font-bold text-sm">
                                  {formatNumber(
                                    calculateTotalReturnQuantityFiltered()
                                  )}{" "}
                                  {getFilteredRollsForReturns()[0]?.units || ""}
                                </td>
                                <td className="p-2"></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {selectedReturnRolls.length > 0 && (
                          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm text-yellow-800">
                                Resumen de devolución:
                              </span>
                              <span className="text-lg font-bold text-yellow-900">
                                {formatNumber(
                                  calculateTotalReturnQuantityFiltered()
                                )}{" "}
                                {getFilteredRollsForReturns()[0]?.units || ""}
                              </span>
                            </div>
                            <div className="text-sm text-yellow-700 mt-1">
                              {selectedReturnRolls.length} rollo(s) de la OC{" "}
                              {selectedOCForReturns}
                              {selectedLotForReturns &&
                                ` (Lote ${selectedLotForReturns})`}
                            </div>
                            <div className="text-sm text-yellow-700">
                              Los rollos se agregarán de vuelta al inventario y
                              packing list
                            </div>
                          </div>
                        )}
                      </>
                    )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <UndoIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>No hay rollos vendidos disponibles para devolución</p>
                  <p className="text-sm mt-2">
                    Los rollos vendidos recientemente aparecerán aquí
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenReturnsDialog(false)}
                disabled={isProcessingReturns}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const currentRolls = getFilteredRollsForReturns();
                  const rollsToReturn: ReturnRollData[] =
                    selectedReturnRolls.map((index: number) => {
                      const roll = currentRolls[index];
                      return {
                        roll_number: roll.roll_number,
                        fabric_type: roll.fabric_type,
                        color: roll.color,
                        lot: roll.lot,
                        oc: roll.oc,
                        almacen: roll.almacen,
                        return_quantity: roll.sold_quantity,
                        units: roll.units,
                        costo: roll.costo || 0,
                        return_reason: "Devolución procesada desde interfaz",
                        sale_id: roll.sale_id,
                        original_sold_date: roll.sold_date,
                      };
                    });

                  handleProcessReturnsWithData(rollsToReturn);
                }}
                disabled={
                  isProcessingReturns ||
                  selectedReturnRolls.length === 0 ||
                  !selectedOCForReturns
                }
                className="flex items-center gap-2"
              >
                {isProcessingReturns ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <UndoIcon className="h-4 w-4" />
                    Procesar Devolución
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
};
