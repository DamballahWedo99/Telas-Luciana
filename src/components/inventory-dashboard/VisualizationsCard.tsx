import React, { useState, useMemo } from "react";
import { ChevronUpIcon, ChevronDownIcon, BarChart3Icon } from "lucide-react";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  InventoryItem,
  FabricCostData,
  FilterOptions,
} from "../../../types/types";

interface VisualizationsCardProps {
  inventory: InventoryItem[];
  filters: FilterOptions;
}

export const VisualizationsCard: React.FC<VisualizationsCardProps> = ({
  inventory,
  filters,
}) => {
  const [visualizationsCollapsed, setVisualizationsCollapsed] = useState(true);

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const { searchTerm, unitFilter, ocFilter, telaFilter, colorFilter } =
          filters;

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
    [inventory, filters]
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

  const NoDataMessage = () => (
    <div className="flex items-center justify-center w-full h-full p-8">
      <p className="text-muted-foreground text-center">
        No hay datos suficientes para mostrar la gráfica. Carga datos o modifica
        los filtros.
      </p>
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center mb-1">
            <BarChart3Icon className="mr-2 h-5 w-5" />
            Visualizaciones
          </CardTitle>
          <CardDescription>
            Análisis gráfico de los datos de inventario
          </CardDescription>
        </div>
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setVisualizationsCollapsed(!visualizationsCollapsed)
                }
              >
                {visualizationsCollapsed ? (
                  <ChevronDownIcon className="h-5 w-5" />
                ) : (
                  <ChevronUpIcon className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{visualizationsCollapsed ? "Expandir" : "Colapsar"}</p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </CardHeader>

      {!visualizationsCollapsed && (
        <CardContent>
          <Tabs defaultValue="units">
            <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-4">
              <TabsTrigger value="units">Unidades</TabsTrigger>
              <TabsTrigger value="fabric">Telas</TabsTrigger>
              <TabsTrigger value="color">Colores</TabsTrigger>
              <TabsTrigger value="orders">Órdenes</TabsTrigger>
              <TabsTrigger value="costs">Costos</TabsTrigger>
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
                            `${formatNumber(value)}`,
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
                        data={visualizationData.colorQuantityData.slice(0, 10)}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 50,
                          bottom: 60,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tickFormatter={(value) => formatNumber(value)} />
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
                        margin={{
                          top: 20,
                          right: 30,
                          left: 50,
                          bottom: 60,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tickFormatter={(value) => formatNumber(value)} />
                        <Tooltip
                          formatter={(value: number) => [
                            `${formatNumber(value)}`,
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
                  <CardTitle>Análisis de Costo Unitario vs Cantidad</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {visualizationData.fabricCostData.MTS.length > 0 ||
                  visualizationData.fabricCostData.KGS.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{
                          top: 20,
                          right: 30,
                          left: 50,
                          bottom: 20,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="Costo Unitario"
                          tickFormatter={(value) => `${formatNumber(value)}`}
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
                                `${formatNumber(value)}`,
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
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
};
