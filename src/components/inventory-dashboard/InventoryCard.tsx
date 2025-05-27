import React, { useState, useMemo, useEffect, useRef } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import {
  ChevronUpIcon,
  ChevronDownIcon,
  DownloadIcon,
  PlusIcon,
  MinusIcon,
  Loader2Icon,
  BoxIcon,
  AlertCircle,
  Filter,
  XCircleIcon,
  Search,
  UploadIcon,
  FolderOpenIcon,
  CheckCircle,
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

import { getInventarioCsv } from "@/lib/s3";
import {
  parseNumericValue,
  mapCsvFields,
  normalizeCsvData,
  formatNumber,
} from "@/lib/utils";
import { InventoryItem, UnitType, ParsedCSVData } from "../../../types/types";

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
  setOpenNewOrder: React.Dispatch<React.SetStateAction<boolean>>;
  isAdmin: boolean;
  isLoading: boolean;
}

interface UploadResult {
  uploadId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileUrl: string;
}

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
  setOpenNewOrder,
  isAdmin,
  isLoading,
}) => {
  const [inventoryCollapsed, setInventoryCollapsed] = useState(false);
  const [openSellDialog, setOpenSellDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null
  );
  const [quantityToUpdate, setQuantityToUpdate] = useState<number>(0);
  const [openPackingListDialog, setOpenPackingListDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sellMode, setSellMode] = useState<"manual" | "rolls">("manual");
  const [packingListData, setPackingListData] = useState<PackingListEntry[]>(
    []
  );
  const [selectedRolls, setSelectedRolls] = useState<number[]>([]);
  const [isLoadingPackingList, setIsLoadingPackingList] = useState(false);
  const [availableRolls, setAvailableRolls] = useState<Roll[]>([]);
  const [selectedLot, setSelectedLot] = useState<number | null>(null);
  const [availableLots, setAvailableLots] = useState<number[]>([]);
  const [rollsGroupedByLot, setRollsGroupedByLot] = useState<
    Map<number, Roll[]>
  >(new Map());

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

  const handleOpenPackingListDialog = () => {
    setOpenPackingListDialog(true);
    setUploadResult(null);
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

  const loadPackingListData = async (tela: string, color: string) => {
    setIsLoadingPackingList(true);
    try {
      const response = await fetch(
        `/api/packing-list/get-rolls?tela=${encodeURIComponent(
          tela
        )}&color=${encodeURIComponent(color)}`
      );

      if (!response.ok) {
        throw new Error("Error al cargar los datos del packing list");
      }

      const data: PackingListEntry[] = await response.json();
      setPackingListData(data);

      const matchingEntries = data.filter(
        (entry) => entry.fabric_type === tela && entry.color === color
      );

      if (matchingEntries.length > 0) {
        const groupedByLot = new Map<number, Roll[]>();
        const lots: number[] = [];

        matchingEntries.forEach((entry) => {
          if (!lots.includes(entry.lot)) {
            lots.push(entry.lot);
          }

          const existingRolls = groupedByLot.get(entry.lot) || [];
          groupedByLot.set(entry.lot, [...existingRolls, ...entry.rolls]);
        });

        setAvailableLots(lots.sort((a, b) => a - b));
        setRollsGroupedByLot(groupedByLot);

        if (lots.length > 0) {
          setSelectedLot(lots[0]);
          setAvailableRolls(groupedByLot.get(lots[0]) || []);
        }
      }
    } catch (error) {
      console.error("Error al cargar packing list:", error);
      toast.error("Error al cargar los datos de los rollos");
    } finally {
      setIsLoadingPackingList(false);
    }
  };

  const handleLotChange = (lot: number) => {
    setSelectedLot(lot);
    setAvailableRolls(rollsGroupedByLot.get(lot) || []);
    setSelectedRolls([]);
  };

  const calculateTotalFromRolls = () => {
    return availableRolls
      .filter((_, index) => selectedRolls.includes(index))
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

  const handleOpenSellDialog = (index: number) => {
    setSelectedItemIndex(index);
    setQuantityToUpdate(0);
    setSellMode("manual");
    setSelectedRolls([]);
    setAvailableRolls([]);
    setSelectedLot(null);
    setOpenSellDialog(true);

    if (inventory[index]) {
      loadPackingListData(inventory[index].Tela, inventory[index].Color);
    }
  };

  const handleOpenAddDialog = (index: number) => {
    setSelectedItemIndex(index);
    setQuantityToUpdate(0);
    setOpenAddDialog(true);
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

      const updatedInventory = [...inventory];
      updatedInventory[selectedItemIndex] = {
        ...item,
        Cantidad: item.Cantidad - quantityToSell,
        Total: item.Costo * (item.Cantidad - quantityToSell),
      };

      setInventory(updatedInventory);

      if (sellMode === "rolls" && selectedRolls.length > 0) {
        try {
          const response = await fetch("/api/packing-list/update-rolls", {
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
          });

          if (!response.ok) {
            throw new Error(
              "Error al actualizar el packing list en el servidor"
            );
          }

          const result = await response.json();
          console.log("Packing list actualizado:", result);

          await loadPackingListData(item.Tela, item.Color);

          toast.success(
            "Rollos vendidos y packing list actualizado correctamente"
          );
        } catch (error) {
          console.error("Error al actualizar el packing list:", error);
          toast.error(
            "Los rollos se vendieron pero hubo un error al actualizar el packing list"
          );
        }
      }

      setOpenSellDialog(false);
      toast.success(
        `Se vendieron ${quantityToSell.toFixed(2)} ${item.Unidades} de ${
          item.Tela
        } ${item.Color}`
      );
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

  const handleExportCSV = () => {
    let csvData;
    let filename = "inventario";

    if (isAdmin) {
      csvData = Papa.unparse(inventory);
      filename = "inventario_completo";
    } else {
      const filteredData = inventory.map((item) => ({
        Tela: item.Tela,
        Color: item.Color,
        Cantidad: item.Cantidad,
        Unidades: item.Unidades,
      }));

      csvData = Papa.unparse(filteredData);
      filename = "inventario_resumido";
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${dateStr}.csv`;
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
      doc.setFontSize(11);
      doc.text(`Fecha: ${dateStr}`, 14, 30);

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

      const filename = isAdmin ? "inventario_completo" : "inventario_resumido";
      const dateForFilename = `${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;

      doc.save(`${filename}_${dateForFilename}.pdf`);

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
      toast.info(`Cargando inventario de ${getMonthName(month)}/${year}...`);

      const csvData = await getInventarioCsv(year, month);

      Papa.parse<ParsedCSVData>(csvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimiter: ",",
        delimitersToGuess: [",", ";", "\t", "|"],

        transform: (value, field) => {
          if (field === "Costo" || field === "Cantidad") {
            return value
              .replace(/\s/g, "")
              .replace(/\$/g, "")
              .replace(/,/g, ".");
          }
          return value;
        },

        complete: (results: Papa.ParseResult<ParsedCSVData>) => {
          try {
            console.log(
              `Columnas en CSV de ${month}/${year}:`,
              results.meta.fields
            );
            console.log("Ejemplo de datos:", results.data.slice(0, 3));

            const fieldMap = mapCsvFields(results.meta.fields || []);
            console.log("Mapeo de campos:", fieldMap);

            let dataToProcess = results.data;
            if (
              Object.keys(fieldMap).length > 0 &&
              Object.keys(fieldMap).length !== results.meta.fields?.length
            ) {
              dataToProcess = normalizeCsvData(results.data, fieldMap);
            }

            const parsedData = dataToProcess.map((item: any) => {
              const costo = parseNumericValue(item.Costo);
              const cantidad = parseNumericValue(item.Cantidad);
              const total = costo * cantidad;

              if (isNaN(costo)) {
                console.warn("Valor de costo inválido:", item.Costo);
              }
              if (isNaN(cantidad)) {
                console.warn("Valor de cantidad inválido:", item.Cantidad);
              }

              return {
                OC: item.OC || "",
                Tela: item.Tela || "",
                Color: item.Color || "",
                Costo: costo,
                Cantidad: cantidad,
                Unidades: (item.Unidades || "") as UnitType,
                Total: total,
                Ubicacion: item.Ubicacion || "",
                Importacion: (item.Importacion || item.Importación || "") as
                  | "DA"
                  | "HOY",
                FacturaDragonAzteca:
                  item["Factura Dragón Azteca"] ||
                  item["Factura Dragon Azteca"] ||
                  item.FacturaDragonAzteca ||
                  "",
              } as InventoryItem;
            });

            setInventory(parsedData);
            toast.success(
              `Inventario de ${getMonthName(
                month
              )}/${year} cargado exitosamente`
            );
          } catch (err) {
            console.error("Error parsing CSV from S3:", err);
            toast.error(
              "Error al procesar el archivo CSV de S3. Verifique el formato."
            );
          }
        },
        error: (error: Error) => {
          console.error("CSV parsing error:", error);
          toast.error("Error al leer el archivo CSV de S3");
        },
      });
    } catch (error) {
      console.error("Error loading historical inventory:", error);
      toast.error("Error al cargar el inventario histórico");
    }
  };

  const filteredInventoryForOC = useMemo(
    () =>
      inventory.filter((item) => {
        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase())
          : item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase());

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
        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase())
          : item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase());

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
        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase())
          : item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase());

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
        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase())
          : item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase());

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
        .filter((tela) => tela !== "")
        .sort(),
    [filteredInventoryForTela]
  );

  const uniqueColors = useMemo(
    () =>
      Array.from(new Set(filteredInventoryForColor.map((item) => item.Color)))
        .filter((color) => color !== "")
        .sort(),
    [filteredInventoryForColor]
  );

  const uniqueUbicaciones = useMemo(
    () =>
      Array.from(
        new Set(filteredInventoryForUbicacion.map((item) => item.Ubicacion))
      )
        .filter((ubicacion) => ubicacion !== "")
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

  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase())
          : item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.toLowerCase());

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

        return (
          matchesSearch &&
          matchesUnit &&
          matchesOC &&
          matchesTela &&
          matchesColor &&
          matchesUbicacion
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

  const hasOCOptions = uniqueOCs.length > 0;
  const hasTelaOptions = uniqueTelas.length > 0;
  const hasColorOptions = uniqueColors.length > 0;
  const hasUbicacionOptions = uniqueUbicaciones.length > 0;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center mb-1">
            <BoxIcon className="mr-2 h-5 w-5" />
            Inventario
          </CardTitle>
          <CardDescription>
            {inventory.length} productos en el sistema
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
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
                  <Button
                    variant="default"
                    size="icon"
                    className="bg-black hover:bg-gray-800 rounded-full"
                    onClick={handleOpenPackingListDialog}
                  >
                    <PlusIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Subir Packing List</p>
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
          </TooltipProvider>
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
                    <SelectTrigger id="unitFilter" className="w-full truncate">
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
                        <TooltipProvider>
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
                        </TooltipProvider>
                      )}
                    </div>
                    <Select value={ocFilter} onValueChange={setOcFilter}>
                      <SelectTrigger id="ocFilter" className="w-full truncate">
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
                      <TooltipProvider>
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
                      </TooltipProvider>
                    )}
                  </div>
                  <Select value={telaFilter} onValueChange={setTelaFilter}>
                    <SelectTrigger id="telaFilter" className="w-full truncate">
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
                      <TooltipProvider>
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
                      </TooltipProvider>
                    )}
                  </div>
                  <Select value={colorFilter} onValueChange={setColorFilter}>
                    <SelectTrigger id="colorFilter" className="w-full truncate">
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
                      <TooltipProvider>
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
                      </TooltipProvider>
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
                      <SelectItem value="Mérida">Mérida</SelectItem>
                      <SelectItem value="Edo Mex">Edo Mex</SelectItem>
                      {uniqueUbicaciones
                        .filter(
                          (ubicacion) =>
                            ubicacion !== "Mérida" && ubicacion !== "Edo Mex"
                        )
                        .map((ubicacion) => (
                          <SelectItem key={ubicacion} value={ubicacion}>
                            {ubicacion}
                          </SelectItem>
                        ))}
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
                  !searchTerm && <span className="text-gray-500">Ninguno</span>}
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
                            <span className="ml-2">Cargando inventario...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredInventory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 10 : 5}
                          className="p-2 align-middle text-center h-24"
                        >
                          No hay datos disponibles
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
                          <td className="p-2 align-middle">{item.Unidades}</td>
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
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleOpenSellDialog(index)
                                        }
                                      >
                                        <MinusIcon className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Vender</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleOpenAddDialog(index)
                                        }
                                      >
                                        <PlusIcon className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Agregar</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
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
        open={openPackingListDialog}
        onOpenChange={setOpenPackingListDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UploadIcon className="mr-2 h-5 w-5" />
              Subir Packing List
            </DialogTitle>
            <DialogDescription>
              Sube un archivo PACKING LIST para procesar automáticamente las
              telas y agregarlas al inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <FolderOpenIcon className="h-12 w-12 text-gray-400 mb-4" />
              <p className="mb-4 text-sm text-gray-500 text-center">
                Selecciona un archivo Excel con la información del Packing List
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
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>Siguiente paso:</strong> El archivo ha sido cargado
                    correctamente al bucket S3. Tu colaborador procesará este
                    archivo con su script Python para extraer la información de
                    las telas.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenPackingListDialog(false)}
            >
              Cerrar
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
              <div className="space-y-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="quantity" className="text-right">
                    Cantidad
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantityToUpdate}
                    onChange={(e) =>
                      setQuantityToUpdate(Number(e.target.value))
                    }
                    className="col-span-3"
                  />
                </div>
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
                        {selectedRolls.length} rollo(s) seleccionado(s) del lote{" "}
                        {selectedLot}
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
            <Button variant="outline" onClick={() => setOpenSellDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSellItem}
              disabled={
                (sellMode === "manual" && quantityToUpdate <= 0) ||
                (sellMode === "rolls" && selectedRolls.length === 0)
              }
            >
              Confirmar Venta
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
                type="number"
                min="0"
                value={quantityToUpdate}
                onChange={(e) => setQuantityToUpdate(Number(e.target.value))}
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
    </Card>
  );
};
