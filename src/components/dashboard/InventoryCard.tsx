import React, { useState, useMemo } from "react";
import Papa from "papaparse";
import { toast } from "sonner";

import {
  ChevronUpIcon,
  ChevronDownIcon,
  DownloadIcon,
  PlusIcon,
  FolderOpenIcon,
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
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  openNewOrder: boolean;
  setOpenNewOrder: React.Dispatch<React.SetStateAction<boolean>>;
  isAdmin: boolean;
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
  setOpenNewOrder,
  isAdmin,
}) => {
  const [inventoryCollapsed, setInventoryCollapsed] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedQuantity, setEditedQuantity] = useState<number>(0);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);

  const isFilterActive = useMemo(() => {
    return (
      searchTerm !== "" ||
      unitFilter !== "all" ||
      ocFilter !== "all" ||
      telaFilter !== "all" ||
      colorFilter !== "all"
    );
  }, [searchTerm, unitFilter, ocFilter, telaFilter, colorFilter]);

  const toggleInventoryCollapsed = () => {
    const newState = !inventoryCollapsed;
    setInventoryCollapsed(newState);

    if (newState && isFilterActive) {
      setSearchTerm("");
      setUnitFilter("all");
      setOcFilter("all");
      setTelaFilter("all");
      setColorFilter("all");
    }
  };

  const handleStartEdit = (index: number, currentQuantity: number) => {
    setEditingIndex(index);
    setEditedQuantity(currentQuantity);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const updatedInventory = [...inventory];
      const item = updatedInventory[editingIndex];
      updatedInventory[editingIndex] = {
        ...item,
        Cantidad: editedQuantity,
        Total: item.Costo * editedQuantity,
      };
      setInventory(updatedInventory);
      setEditingIndex(null);
      toast.success("Cantidad actualizada exitosamente");
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
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
    toast.info("Funcionalidad de exportar a PDF en desarrollo");
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

            {/* Nuevo botón para cargar inventario histórico */}
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

            {/* Solo mostrar el botón de añadir nueva orden si es admin */}
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

              {/* Solo mostrar el filtro OC para administradores */}
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
                    {isAdmin && <TableHead>Importación</TableHead>}
                    {isAdmin && <TableHead>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 9 : 4}
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
                        <TableCell>
                          {isAdmin && editingIndex === index ? (
                            <Input
                              type="number"
                              value={editedQuantity}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                              ) =>
                                setEditedQuantity(parseFloat(e.target.value))
                              }
                              className="w-24"
                            />
                          ) : (
                            formatNumber(item.Cantidad)
                          )}
                        </TableCell>
                        <TableCell>{item.Unidades}</TableCell>
                        {isAdmin && (
                          <TableCell>${formatNumber(item.Total)}</TableCell>
                        )}
                        {isAdmin && <TableCell>{item.Importacion}</TableCell>}
                        {isAdmin && (
                          <TableCell>
                            {editingIndex === index ? (
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleSaveEdit}
                                >
                                  Guardar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleStartEdit(index, item.Cantidad)
                                }
                              >
                                Editar
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </>
      )}

      {/* Diálogo para seleccionar inventario histórico */}
      <InventoryHistoryDialog
        open={openHistoryDialog}
        setOpen={setOpenHistoryDialog}
        onLoadInventory={handleLoadHistoricalInventory}
      />
    </Card>
  );
};
