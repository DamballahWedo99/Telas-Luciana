import React, { useState, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { InventoryHistoryDialog } from "@/components/dashboard/InventoryHistoryDialog";
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
  const [inventoryCollapsed, setInventoryCollapsed] = useState(false);
  const [openSellDialog, setOpenSellDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null
  );
  const [quantityToUpdate, setQuantityToUpdate] = useState<number>(0);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);

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

  const uniqueOCs = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.OC))).sort(),
    [inventory]
  );

  const uniqueTelas = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.Tela))).sort(),
    [inventory]
  );

  const uniqueColors = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.Color))).sort(),
    [inventory]
  );

  const uniqueUbicaciones = useMemo(
    () =>
      Array.from(new Set(inventory.map((item) => item.Ubicacion)))
        .filter(Boolean)
        .sort(),
    [inventory]
  );

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

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle>Inventario</CardTitle>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
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
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpenHistoryDialog(true)}
                  >
                    <FolderOpenIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cargar inventario histórico</p>
                </TooltipContent>
              </Tooltip>
            )}

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
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="search">Buscar</Label>
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
                  className="mt-1"
                />
              </div>

              <div className="min-w-[150px]">
                <Label htmlFor="unitFilter">Unidades</Label>
                <Select
                  value={unitFilter}
                  onValueChange={(value) =>
                    setUnitFilter(value as UnitType | "all")
                  }
                >
                  <SelectTrigger id="unitFilter" className="mt-1">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="MTS">MTS</SelectItem>
                    <SelectItem value="KGS">KGS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <div className="min-w-[150px]">
                  <Label htmlFor="ocFilter">OC</Label>
                  <Select value={ocFilter} onValueChange={setOcFilter}>
                    <SelectTrigger id="ocFilter" className="mt-1">
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
              )}

              <div className="min-w-[150px]">
                <Label htmlFor="telaFilter">Tela</Label>
                <Select value={telaFilter} onValueChange={setTelaFilter}>
                  <SelectTrigger id="telaFilter" className="mt-1">
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

              <div className="min-w-[150px]">
                <Label htmlFor="colorFilter">Color</Label>
                <Select value={colorFilter} onValueChange={setColorFilter}>
                  <SelectTrigger id="colorFilter" className="mt-1">
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

              <div className="min-w-[150px]">
                <Label htmlFor="ubicacionFilter">Ubicación</Label>
                <Select
                  value={ubicacionFilter}
                  onValueChange={setUbicacionFilter}
                >
                  <SelectTrigger id="ubicacionFilter" className="mt-1">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Mérida">Mérida</SelectItem>
                    <SelectItem value="Edo Mex">Edo Mex</SelectItem>
                    {uniqueUbicaciones.map(
                      (ubicacion) =>
                        ubicacion !== "Mérida" &&
                        ubicacion !== "Edo Mex" && (
                          <SelectItem key={ubicacion} value={ubicacion}>
                            {ubicacion}
                          </SelectItem>
                        )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>

          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>OC</TableHead>}
                    <TableHead>Tela</TableHead>
                    <TableHead>Color</TableHead>
                    {isAdmin && <TableHead>Costo</TableHead>}
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Unidades</TableHead>
                    {isAdmin && <TableHead>Total</TableHead>}
                    <TableHead>Ubicación</TableHead>
                    {isAdmin && <TableHead>Importación</TableHead>}
                    {isAdmin && <TableHead>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 10 : 5}
                        className="h-24 text-center"
                      >
                        <div className="flex justify-center items-center">
                          <Loader2Icon className="h-8 w-8 animate-spin text-gray-500" />
                          <span className="ml-2">Cargando inventario...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredInventory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 10 : 5}
                        className="h-24 text-center"
                      >
                        No hay datos disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInventory.map((item, index) => (
                      <TableRow key={index}>
                        {isAdmin && <TableCell>{item.OC}</TableCell>}
                        <TableCell>{item.Tela}</TableCell>
                        <TableCell>{item.Color}</TableCell>
                        {isAdmin && (
                          <TableCell>${formatNumber(item.Costo)}</TableCell>
                        )}
                        <TableCell>{formatNumber(item.Cantidad)}</TableCell>
                        <TableCell>{item.Unidades}</TableCell>
                        {isAdmin && (
                          <TableCell>${formatNumber(item.Total)}</TableCell>
                        )}
                        <TableCell>{item.Ubicacion || "-"}</TableCell>
                        {isAdmin && <TableCell>{item.Importacion}</TableCell>}
                        {isAdmin && (
                          <TableCell>
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
                                      onClick={() => handleOpenAddDialog(index)}
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
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!isLoading && filteredInventory.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      {isAdmin && (
                        <TableCell colSpan={3} className="font-bold">
                          Total
                        </TableCell>
                      )}
                      {!isAdmin && (
                        <TableCell colSpan={2} className="font-bold">
                          Total
                        </TableCell>
                      )}
                      {isAdmin && <TableCell></TableCell>}
                      <TableCell className="font-bold">
                        {formatNumber(totalCantidad)}
                      </TableCell>
                      <TableCell></TableCell>
                      {isAdmin && (
                        <TableCell className="font-bold">
                          ${formatNumber(totalCosto)}
                        </TableCell>
                      )}
                      <TableCell></TableCell>
                      {isAdmin && <TableCell></TableCell>}
                      {isAdmin && <TableCell></TableCell>}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
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

      {/* Diálogo para seleccionar inventario histórico - Solo para admin y major_admin */}
      {isAdmin && (
        <InventoryHistoryDialog
          open={openHistoryDialog}
          setOpen={setOpenHistoryDialog}
          onLoadInventory={handleLoadHistoricalInventory}
        />
      )}
    </Card>
  );
};
