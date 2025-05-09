import React, { useState, useMemo, useEffect } from "react";
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
  FolderOpenIcon,
  Loader2Icon,
  BoxIcon,
  AlertCircle,
  Filter,
  XCircleIcon,
  Search,
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

import { InventoryHistoryDialog } from "@/components/inventory-dashboard/InventoryHistoryDialog";
import { getInventarioCsv } from "@/lib/s3";
import {
  parseNumericValue,
  mapCsvFields,
  normalizeCsvData,
  formatNumber,
} from "@/lib/utils";
import { InventoryItem, UnitType, ParsedCSVData } from "../../../types/types";

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
  // Función para limpiar todos los filtros
  const resetAllFilters = () => {
    setSearchTerm("");
    setUnitFilter("all");
    setOcFilter("all");
    setTelaFilter("all");
    setColorFilter("all");
    setUbicacionFilter("all");
  };
  const [inventoryCollapsed, setInventoryCollapsed] = useState(false);
  const [openSellDialog, setOpenSellDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null
  );
  const [quantityToUpdate, setQuantityToUpdate] = useState<number>(0);

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

  const handleOpenSellDialog = (index: number) => {
    setSelectedItemIndex(index);
    setQuantityToUpdate(0);
    setOpenSellDialog(true);
  };

  const handleOpenAddDialog = (index: number) => {
    setSelectedItemIndex(index);
    setQuantityToUpdate(0);
    setOpenAddDialog(true);
  };

  const handleSellItem = () => {
    if (selectedItemIndex !== null && quantityToUpdate > 0) {
      const updatedInventory = [...inventory];
      const item = updatedInventory[selectedItemIndex];

      if (quantityToUpdate > item.Cantidad) {
        toast.error(
          "La cantidad a vender no puede ser mayor que el inventario disponible"
        );
        return;
      }

      updatedInventory[selectedItemIndex] = {
        ...item,
        Cantidad: item.Cantidad - quantityToUpdate,
        Total: item.Costo * (item.Cantidad - quantityToUpdate),
      };

      setInventory(updatedInventory);
      setOpenSellDialog(false);
      toast.success(
        `Se vendieron ${quantityToUpdate} ${item.Unidades} de ${item.Tela} ${item.Color}`
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

  // Primero, calculamos el inventario filtrado basado en todos los filtros excepto
  // el propio filtro para el que estamos calculando las opciones
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

  // Ahora calculamos las opciones únicas para cada filtro basado en su inventario filtrado específico
  // CORRECCIÓN: Filtrar valores vacíos en las listas de opciones
  const uniqueOCs = useMemo(
    () =>
      Array.from(new Set(filteredInventoryForOC.map((item) => item.OC)))
        .filter((oc) => oc !== "") // Filtrar strings vacíos
        .sort(),
    [filteredInventoryForOC]
  );

  const uniqueTelas = useMemo(
    () =>
      Array.from(new Set(filteredInventoryForTela.map((item) => item.Tela)))
        .filter((tela) => tela !== "") // Filtrar strings vacíos
        .sort(),
    [filteredInventoryForTela]
  );

  const uniqueColors = useMemo(
    () =>
      Array.from(new Set(filteredInventoryForColor.map((item) => item.Color)))
        .filter((color) => color !== "") // Filtrar strings vacíos
        .sort(),
    [filteredInventoryForColor]
  );

  const uniqueUbicaciones = useMemo(
    () =>
      Array.from(
        new Set(filteredInventoryForUbicacion.map((item) => item.Ubicacion))
      )
        .filter((ubicacion) => ubicacion !== "") // Filtrar strings vacíos
        .sort(),
    [filteredInventoryForUbicacion]
  );

  // Lógica para restablecer filtros cuando las opciones seleccionadas ya no están disponibles
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

  // Verificar si hay opciones disponibles
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

            {/* Botón para cargar inventario histórico - Solo para admin y major_admin */}

            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="bg-black hover:bg-gray-800 rounded-full"
                    onClick={() => setOpenNewOrder(true)}
                  >
                    <PlusIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Añadir Nueva Orden</p>
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
              {/* Search bar - más grande */}
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

              {/* Unidades filter - más pequeño */}
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

              {/* OC filter - Solo para admin - más pequeño */}
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

              {/* Tela filter - más pequeño */}
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

              {/* Color filter - más pequeño */}
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

              {/* Ubicación filter - más pequeño */}
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

            {/* Filter summary */}
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
            {/* Tabla con dirección nativa en HTML */}
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

      <Dialog open={openSellDialog} onOpenChange={setOpenSellDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vender Producto</DialogTitle>
            <DialogDescription>
              {selectedItemIndex !== null &&
                `Ingrese la cantidad de ${inventory[selectedItemIndex]?.Tela} ${inventory[selectedItemIndex]?.Color} que desea vender.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Cantidad
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantityToUpdate}
                onChange={(e) => setQuantityToUpdate(Number(e.target.value))}
                className="col-span-3"
              />
            </div>
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
            <Button onClick={handleSellItem}>Confirmar Venta</Button>
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
