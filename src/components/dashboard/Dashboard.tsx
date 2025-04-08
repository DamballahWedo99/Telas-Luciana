"use client";

import React, { useState, useMemo } from "react";
import Papa from "papaparse";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type UnitType = "MTS" | "KGS";

export interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: UnitType;
  Total: number;
  Importacion: "DA" | "HOY";
  FacturaDragonAzteca: string;
}

interface DashboardProps {
  onLogout?: () => void;
}

interface NewOrderForm {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: UnitType;
  Importacion: "DA" | "HOY";
  FacturaDragonAzteca: string;
}

interface FabricCostDataPoint {
  x: number;
  y: number;
  z: string;
  size: number;
}

interface FabricCostData {
  MTS: FabricCostDataPoint[];
  KGS: FabricCostDataPoint[];
}

interface ParsedCSVData {
  OC?: string;
  Tela?: string;
  Color?: string;
  Costo?: string;
  Cantidad?: string;
  Unidades?: string;
  Importacion?: string;
  Importación?: string;
  "Factura Dragón Azteca"?: string;
  "Factura Dragon Azteca"?: string;
  FacturaDragonAzteca?: string;
  [key: string]: string | undefined;
}

const formatNumber = (num: number) => {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState<UnitType | "all">("all");
  const [ocFilter, setOcFilter] = useState<string>("all");
  const [telaFilter, setTelaFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedQuantity, setEditedQuantity] = useState<number>(0);
  const [openNewOrder, setOpenNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState<NewOrderForm>({
    OC: "",
    Tela: "",
    Color: "",
    Costo: 0,
    Cantidad: 0,
    Unidades: "MTS",
    Importacion: "DA",
    FacturaDragonAzteca: "",
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<ParsedCSVData>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<ParsedCSVData>) => {
        try {
          console.log("Raw CSV data:", results.data);
          const parsedData = results.data.map((item: ParsedCSVData) => {
            const costo = parseFloat(item.Costo || "0");
            const cantidad = parseFloat(item.Cantidad || "0");
            const total = costo * cantidad;

            console.log("Invoice field:", {
              raw: item["Factura Dragón Azteca"],
              alt1: item["Factura Dragon Azteca"],
              alt2: item.FacturaDragonAzteca,
            });

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
          setSuccess("Archivo cargado exitosamente");
          setError("");
        } catch (err) {
          console.error("Error parsing CSV:", err);
          setError("Error al procesar el archivo CSV. Verifique el formato.");
          setSuccess("");
        }
      },
      error: (error: Error) => {
        console.error("CSV parsing error:", error);
        setError("Error al leer el archivo CSV");
        setSuccess("");
      },
    });
  };

  const handleExport = () => {
    const csv = Papa.unparse(inventory);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "inventario.csv";
    link.click();
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

  const chartData = useMemo(
    () => [
      {
        name: "MTS",
        value: filteredInventory
          .filter((item) => item.Unidades === "MTS")
          .reduce((sum, item) => sum + item.Cantidad, 0),
      },
      {
        name: "KGS",
        value: filteredInventory
          .filter((item) => item.Unidades === "KGS")
          .reduce((sum, item) => sum + item.Cantidad, 0),
      },
    ],
    [filteredInventory]
  );

  const keyMetrics = useMemo(() => {
    const mtsItems = filteredInventory.filter(
      (item) => item.Unidades === "MTS"
    );
    const kgsItems = filteredInventory.filter(
      (item) => item.Unidades === "KGS"
    );

    return {
      mts: {
        totalQuantity: mtsItems.reduce((sum, item) => sum + item.Cantidad, 0),
        totalCost: mtsItems.reduce((sum, item) => sum + item.Total, 0),
        itemCount: mtsItems.length,
      },
      kgs: {
        totalQuantity: kgsItems.reduce((sum, item) => sum + item.Cantidad, 0),
        totalCost: kgsItems.reduce((sum, item) => sum + item.Total, 0),
        itemCount: kgsItems.length,
      },
      overall: {
        totalCost: filteredInventory.reduce((sum, item) => sum + item.Total, 0),
        itemCount: filteredInventory.length,
      },
    };
  }, [filteredInventory]);

  const visualizationData = useMemo(() => {
    const fabricValueData = Object.entries(
      filteredInventory.reduce((acc, item) => {
        const key = item.Tela as string;
        acc[key] = (acc[key] || 0) + item.Total;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const colorQuantityData = Object.entries(
      filteredInventory.reduce((acc, item) => {
        const key = item.Color as string;
        acc[key] = (acc[key] || 0) + item.Cantidad;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const ocValueData = Object.entries(
      filteredInventory.reduce((acc, item) => {
        const key = item.OC as string;
        acc[key] = (acc[key] || 0) + item.Total;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const fabricCostData: FabricCostData = {
      MTS: filteredInventory
        .filter((item) => item.Unidades === "MTS")
        .map((item) => ({
          x: item.Costo,
          y: item.Cantidad,
          z: item.Tela,
          size: item.Total,
        })),
      KGS: filteredInventory
        .filter((item) => item.Unidades === "KGS")
        .map((item) => ({
          x: item.Costo,
          y: item.Cantidad,
          z: item.Tela,
          size: item.Total,
        })),
    };

    const invoiceData = Object.entries(
      filteredInventory.reduce((acc, item) => {
        const invoiceNumber = item.FacturaDragonAzteca || "";
        if (invoiceNumber) {
          acc[invoiceNumber] = (acc[invoiceNumber] || 0) + item.Total;
        }
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const groupedInventory = filteredInventory.reduce((acc, item) => {
      const key = `${item.Tela}-${item.Color}`;
      if (!acc[key]) {
        acc[key] = {
          tela: item.Tela,
          color: item.Color,
          cantidad: 0,
          costo: 0,
        };
      }
      acc[key].cantidad += item.Cantidad;
      acc[key].costo += item.Costo;
      return acc;
    }, {} as Record<string, { tela: string; color: string; cantidad: number; costo: number }>);

    const costDistribution = Object.values(groupedInventory)
      .sort((a, b) => b.costo - a.costo)
      .map((item) => ({
        name: `${item.tela} (${item.color})`,
        value: item.costo,
      }));

    const turnoverData = Object.values(groupedInventory)
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((item) => ({
        name: `${item.tela} (${item.color})`,
        value: item.cantidad,
      }));

    const fabricColorData = Object.values(groupedInventory)
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((item) => ({
        tela: item.tela,
        color: item.color,
        value: item.cantidad,
      }));

    return {
      fabricValueData,
      colorQuantityData,
      ocValueData,
      fabricCostData,
      invoiceData,
      costDistribution,
      turnoverData,
      fabricColorData,
    };
  }, [filteredInventory]);

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
  ];

  const isAdmin = true;

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
      setSuccess("Cantidad actualizada exitosamente");
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleOpenNewOrder = () => {
    setOpenNewOrder(true);
  };

  const handleCloseNewOrder = () => {
    setOpenNewOrder(false);
    setNewOrder({
      OC: "",
      Tela: "",
      Color: "",
      Costo: 0,
      Cantidad: 0,
      Unidades: "MTS",
      Importacion: "DA",
      FacturaDragonAzteca: "",
    });
  };

  const handleNewOrderChange = (
    field: keyof NewOrderForm,
    value: string | number
  ) => {
    setNewOrder((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveNewOrder = () => {
    const total = newOrder.Costo * newOrder.Cantidad;
    const newItem: InventoryItem = {
      ...newOrder,
      Total: total,
    };

    setInventory((prev) => [...prev, newItem]);
    setSuccess("Nueva orden agregada exitosamente");
    handleCloseNewOrder();
  };

  const NoDataMessage = () => (
    <div className="flex items-center justify-center w-full h-full p-8">
      <p className="text-muted-foreground text-center">
        No hay datos suficientes para mostrar la gráfica. Carga datos o modifica
        los filtros.
      </p>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="my-4">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold">Panel de Control de Inventario</h1>
          {onLogout && (
            <Button variant="ghost" onClick={onLogout}>
              Cerrar sesión
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4">
            <AlertTitle>Éxito</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
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
          <CardFooter className="flex gap-2">
            <Button variant="outline" asChild>
              <label>
                Cargar CSV
                <input
                  type="file"
                  hidden
                  accept=".csv"
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={inventory.length === 0}
            >
              Exportar CSV
            </Button>
            <Button onClick={handleOpenNewOrder}>Nueva Orden</Button>
          </CardFooter>
        </Card>

        {/* Key Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-600">MTS</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">
                Cantidad Total: {formatNumber(keyMetrics.mts.totalQuantity)} MTS
              </p>
              {isAdmin && (
                <p className="text-lg font-medium text-green-600">
                  Costo Total: ${formatNumber(keyMetrics.mts.totalCost)}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {keyMetrics.mts.itemCount} items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-600">KGS</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">
                Cantidad Total: {formatNumber(keyMetrics.kgs.totalQuantity)} KGS
              </p>
              {isAdmin && (
                <p className="text-lg font-medium text-green-600">
                  Costo Total: ${formatNumber(keyMetrics.kgs.totalCost)}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {keyMetrics.kgs.itemCount} items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">
                Total Items: {formatNumber(keyMetrics.overall.itemCount)}
              </p>
              {isAdmin && (
                <p className="text-lg font-medium text-green-600">
                  Costo Total General: $
                  {formatNumber(keyMetrics.overall.totalCost)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>
              {filteredInventory.length} items encontrados
            </CardDescription>
          </CardHeader>
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
                    <TableHead>Factura Dragon Azteca</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 10 : 8}
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
                        <TableCell>{item.FacturaDragonAzteca}</TableCell>
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
        </Card>

        {/* Visualizaciones y Gráficas */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Visualizaciones</CardTitle>
            <CardDescription>
              Análisis gráfico de los datos de inventario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="units">
              <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-4">
                <TabsTrigger value="units">Unidades</TabsTrigger>
                <TabsTrigger value="fabric">Telas</TabsTrigger>
                <TabsTrigger value="color">Colores</TabsTrigger>
                <TabsTrigger value="orders">Órdenes</TabsTrigger>
                <TabsTrigger value="costs">Costos</TabsTrigger>
                <TabsTrigger value="invoices">Facturas</TabsTrigger>
              </TabsList>

              {/* Resumen por Unidades */}
              <TabsContent value="units">
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen por Unidades</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {chartData.some((item) => item.value > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart width={600} height={300} data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: number) => [
                              formatNumber(value),
                              "Cantidad",
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="value" fill="#2980b9" name="Cantidad" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Valor por Tipo de Tela */}
              <TabsContent value="fabric">
                <Card>
                  <CardHeader>
                    <CardTitle>Valor por Tipo de Tela</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.fabricValueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={visualizationData.fabricValueData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            label={({
                              name,
                              percent,
                            }: {
                              name: string;
                              percent: number;
                            }) => `${name}: ${(percent * 100).toFixed(2)}%`}
                          >
                            {visualizationData.fabricValueData.map(
                              (entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              )
                            )}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [
                              `$${formatNumber(value)}`,
                              "Valor",
                            ]}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cantidad por Color */}
              <TabsContent value="color">
                <Card>
                  <CardHeader>
                    <CardTitle>Cantidad por Color</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.colorQuantityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visualizationData.colorQuantityData.slice(
                            0,
                            10
                          )}
                          margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tickFormatter={(value) => formatNumber(value)}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              formatNumber(value),
                              "Cantidad",
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="value" fill="#8884d8" name="Cantidad" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Valor por Orden de Compra */}
              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <CardTitle>Valor por Orden de Compra</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.ocValueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visualizationData.ocValueData.slice(0, 10)}
                          margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tickFormatter={(value) => formatNumber(value)}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              `$${formatNumber(value)}`,
                              "Valor",
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="value" fill="#82ca9d" name="Valor" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Análisis de Costo Unitario vs Cantidad */}
              <TabsContent value="costs">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Análisis de Costo Unitario vs Cantidad
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.fabricCostData.MTS.length > 0 ||
                    visualizationData.fabricCostData.KGS.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                          margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            dataKey="x"
                            name="Costo Unitario"
                            tickFormatter={(value) => `$${formatNumber(value)}`}
                            domain={["auto", "auto"]}
                          />
                          <YAxis
                            type="number"
                            dataKey="y"
                            name="Cantidad"
                            tickFormatter={(value) => formatNumber(value)}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            formatter={(value: number, name: string) => {
                              if (name === "x")
                                return [
                                  `$${formatNumber(value)}`,
                                  "Costo Unitario",
                                ];
                              return [formatNumber(value), "Cantidad"];
                            }}
                            labelFormatter={(label: any) => `Tela: ${label.z}`}
                          />
                          <Legend />
                          <Scatter
                            data={visualizationData.fabricCostData.MTS}
                            fill="#8884d8"
                            name="MTS"
                          />
                          <Scatter
                            data={visualizationData.fabricCostData.KGS}
                            fill="#82ca9d"
                            name="KGS"
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Análisis de Facturas */}
              <TabsContent value="invoices">
                <Card>
                  <CardHeader>
                    <CardTitle>Análisis de Facturas</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.invoiceData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visualizationData.invoiceData.slice(0, 10)}
                          margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tickFormatter={(value) => formatNumber(value)}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              `$${formatNumber(value)}`,
                              "Valor",
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="value" fill="#8884d8" name="Valor" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* New Order Dialog */}
        <Dialog open={openNewOrder} onOpenChange={setOpenNewOrder}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Nueva Orden de Compra</DialogTitle>
              <DialogDescription>
                Completa los campos para agregar una nueva orden al inventario.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="oc">Orden de Compra</Label>
                  <Input
                    id="oc"
                    value={newOrder.OC}
                    onChange={(e) => handleNewOrderChange("OC", e.target.value)}
                    placeholder="OC"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tela">Tela</Label>
                  <Input
                    id="tela"
                    value={newOrder.Tela}
                    onChange={(e) =>
                      handleNewOrderChange("Tela", e.target.value)
                    }
                    placeholder="Nombre de la tela"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={newOrder.Color}
                    onChange={(e) =>
                      handleNewOrderChange("Color", e.target.value)
                    }
                    placeholder="Color"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costo">Costo</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">
                      $
                    </span>
                    <Input
                      id="costo"
                      type="number"
                      value={newOrder.Costo}
                      onChange={(e) =>
                        handleNewOrderChange(
                          "Costo",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cantidad">Cantidad</Label>
                  <Input
                    id="cantidad"
                    type="number"
                    value={newOrder.Cantidad}
                    onChange={(e) =>
                      handleNewOrderChange(
                        "Cantidad",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unidades">Unidades</Label>
                  <Select
                    value={newOrder.Unidades}
                    onValueChange={(value) =>
                      handleNewOrderChange("Unidades", value as UnitType)
                    }
                  >
                    <SelectTrigger id="unidades">
                      <SelectValue placeholder="Seleccionar unidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTS">MTS</SelectItem>
                      <SelectItem value="KGS">KGS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="importacion">Importación</Label>
                  <Select
                    value={newOrder.Importacion}
                    onValueChange={(value) =>
                      handleNewOrderChange("Importacion", value as "DA" | "HOY")
                    }
                  >
                    <SelectTrigger id="importacion">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DA">DA</SelectItem>
                      <SelectItem value="HOY">HOY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="factura">Factura Dragón Azteca</Label>
                  <Input
                    id="factura"
                    value={newOrder.FacturaDragonAzteca}
                    onChange={(e) =>
                      handleNewOrderChange(
                        "FacturaDragonAzteca",
                        e.target.value
                      )
                    }
                    placeholder="Número de factura"
                  />
                </div>
              </div>

              <div className="bg-muted p-3 rounded-md">
                <p className="font-semibold">
                  Total: ${formatNumber(newOrder.Costo * newOrder.Cantidad)}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={handleCloseNewOrder}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveNewOrder}
                disabled={
                  !newOrder.OC ||
                  !newOrder.Tela ||
                  !newOrder.Color ||
                  !newOrder.Costo ||
                  !newOrder.Cantidad ||
                  !newOrder.Unidades
                }
              >
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;
