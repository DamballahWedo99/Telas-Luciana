import React, { useState, useMemo } from "react";
import Papa from "papaparse";
import { toast } from "sonner";

import {
  ChevronUpIcon,
  ChevronDownIcon,
  DownloadIcon,
  PlusIcon,
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

import { InventoryItem, UnitType } from "../../../types/types";

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
}) => {
  const [inventoryCollapsed, setInventoryCollapsed] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedQuantity, setEditedQuantity] = useState<number>(0);

  const isAdmin = true;

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
    const csv = Papa.unparse(inventory);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "inventario.csv";
    link.click();
  };

  const handleExportPDF = () => {
    toast.info("Funcionalidad de exportar a PDF en desarrollo");
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
        const matchesSearch =
          item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Color.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;
        const matchesOC = ocFilter === "all" || item.OC === ocFilter;
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
    [inventory, searchTerm, unitFilter, ocFilter, telaFilter, colorFilter]
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
                  placeholder="Buscar por OC, Tela, o Color"
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
                    <TableHead>OC</TableHead>
                    <TableHead>Tela</TableHead>
                    <TableHead>Color</TableHead>
                    {isAdmin && <TableHead>Costo</TableHead>}
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Unidades</TableHead>
                    {isAdmin && <TableHead>Total</TableHead>}
                    <TableHead>Importación</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 8 : 6}
                        className="h-24 text-center"
                      >
                        No hay datos disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInventory.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.OC}</TableCell>
                        <TableCell>{item.Tela}</TableCell>
                        <TableCell>{item.Color}</TableCell>
                        {isAdmin && (
                          <TableCell>${formatNumber(item.Costo)}</TableCell>
                        )}
                        <TableCell>
                          {editingIndex === index ? (
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
                        <TableCell>{item.Importacion}</TableCell>
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
};
