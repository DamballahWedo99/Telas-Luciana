import React, { useState } from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  Cell,
  TooltipProps,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChartDataItem {
  name: string;
  value: number;
}

interface BarChartDataItem {
  name: string;
  fullName?: string; // Campo opcional para nombre completo
  total: number;
}

interface TimelineDataItem {
  date: string;
  count: number;
  total: number;
}

interface DeliveryDataItem {
  orden: string;
  days: number;
  total: number;
}

interface PedidosChartsProps {
  pieChartData: ChartDataItem[];
  barChartData: BarChartDataItem[];
  timelineData: TimelineDataItem[];
  deliveryData: DeliveryDataItem[];
  onTabChange?: (value: string) => void;
}

export const PedidosCharts: React.FC<PedidosChartsProps> = ({
  pieChartData,
  barChartData,
  timelineData,
  deliveryData,
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState("orders");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (onTabChange) onTabChange(value);
  };

  // Chart colors
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
  ];

  const formatCurrency = (value: number, decimals = 2): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Función para formatear la fecha en el tooltip (mantener el formato original)
  const formatDateLabel = (dateStr: string): string => {
    // Suponiendo que dateStr tiene un formato como "2023-01"
    const [year, month] = dateStr.split("-");

    // Convertir el número de mes a nombre de mes
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    const monthName = monthNames[parseInt(month) - 1] || month;

    return `${monthName} ${year}`;
  };

  // Custom tooltip component for Timeline Tab
  const TimelineCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900 mb-2">
            {formatDateLabel(label)}
          </p>
          <p className="text-purple-600 mb-1">
            Cantidad de Pedidos: {payload[0].value}
          </p>
          <p className="text-green-600">
            Total Facturado (USD): ${formatCurrency(payload[1].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Tooltip personalizado para las órdenes
  const OrdersCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900 mb-2">
            {data.fullName || data.name}
          </p>
          <p className="text-blue-600">
            Total Facturado: ${formatCurrency(data.total)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Ordenar los datos para "Órdenes de Compra" por total (de mayor a menor)
  const sortedBarChartData = [...barChartData].sort(
    (a, b) => b.total - a.total
  );

  // Ordenar los datos de colores por valor (de mayor a menor)
  const sortedColorData = [...pieChartData].sort((a, b) => b.value - a.value);

  // Genera ticks personalizados para mostrar solo los años cuando cambian
  const generateCustomTicks = (data: TimelineDataItem[]) => {
    if (!data || data.length === 0) return [];

    const uniqueYears = new Set<string>();
    const customTicks: string[] = [];

    data.forEach((item) => {
      const year = item.date.split("-")[0];
      if (!uniqueYears.has(year)) {
        uniqueYears.add(year);
        customTicks.push(item.date);
      }
    });

    return customTicks;
  };

  // Calcular la altura dinámica para el gráfico de órdenes basado en la cantidad de datos
  const calculateOrdersChartHeight = () => {
    // Mínimo 400px, pero añade 50px por cada orden para asegurar espacio suficiente
    const minHeight = 400;
    const heightPerItem = 50;
    return Math.max(minHeight, sortedBarChartData.length * heightPerItem);
  };

  // Altura dinámica para el gráfico de órdenes
  const ordersChartHeight = calculateOrdersChartHeight();

  return (
    <Tabs
      defaultValue="orders"
      className="w-full"
      onValueChange={handleTabChange}
    >
      <TabsList className="grid grid-cols-4 mb-4">
        <TabsTrigger value="orders">Órdenes de Compra</TabsTrigger>
        <TabsTrigger value="colors">Distribución por Color</TabsTrigger>
        <TabsTrigger value="timeline">Evolución Mensual</TabsTrigger>
        <TabsTrigger value="delivery">Tiempos de Entrega</TabsTrigger>
      </TabsList>

      {/* Tab: Órdenes de Compra - OPTIMIZADA PARA NOMBRES COMPLETOS */}
      <TabsContent value="orders" className="mt-4">
        <div
          className="w-full bg-white p-4 rounded-lg shadow-sm overflow-y-auto"
          style={{ height: `${ordersChartHeight}px` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={sortedBarChartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              layout="vertical"
              barSize={25}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `$${formatCurrency(value)}`}
                domain={[0, "dataMax"]}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={200} // Ancho muy generoso para mostrar nombres completos
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<OrdersCustomTooltip />} />
              <Legend />
              <Bar
                dataKey="total"
                fill="#0088FE"
                name="Total Factura (USD)"
                radius={[0, 4, 4, 0]}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Tab: Distribución por Color (Convertido a BarChart) */}
      <TabsContent value="colors" className="mt-4">
        <div
          className="w-full bg-white p-4 rounded-lg shadow-sm"
          style={{ height: "320px" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={sortedColorData}
              margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
              layout="vertical"
              barSize={25}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                axisLine={true}
                tickLine={true}
                tickFormatter={(value: number) => `${formatCurrency(value)}`}
                domain={[0, "dataMax"]}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={true}
                tickLine={true}
                width={150}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [
                  `${formatCurrency(value)}`,
                  "Total",
                ]}
                contentStyle={{ borderRadius: "8px" }}
              />
              <Legend />
              <Bar dataKey="value" name="Valor Total" radius={[0, 4, 4, 0]}>
                {sortedColorData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Tab: Evolución Mensual (Modificada) - CON FORMATO DE MONEDA EN EJE Y */}
      <TabsContent value="timeline" className="mt-4">
        <div
          className="w-full bg-white p-4 rounded-lg shadow-sm"
          style={{ height: "320px" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timelineData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                ticks={generateCustomTicks(timelineData)}
                tickFormatter={(value) => value.split("-")[0]}
              />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `$${formatCurrency(value)}`}
                width={100} // Ancho aumentado para acomodar el formato de moneda
              />
              <Tooltip content={<TimelineCustomTooltip />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                name="Cantidad de Pedidos"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="total"
                stroke="#82ca9d"
                name="Total Facturado (USD)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Tab: Tiempos de Entrega */}
      <TabsContent value="delivery" className="mt-4">
        <div
          className="w-full bg-white p-4 rounded-lg shadow-sm"
          style={{ height: "320px" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                dataKey="days"
                name="Días"
                unit=" días"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="total"
                name="Total Factura"
                unit=" USD"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `$${formatCurrency(value)}`}
                width={100} // Ancho aumentado para acomodar el formato de moneda
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number, name: string) => [
                  name === "total"
                    ? `$${formatCurrency(value)}`
                    : `${value} días`,
                  name === "total" ? "Total Factura" : "Tiempo de Entrega",
                ]}
                labelFormatter={(value: number) => {
                  const item = deliveryData[value];
                  return `Orden: ${item?.orden || ""}`;
                }}
                contentStyle={{ borderRadius: "8px" }}
              />
              <Scatter name="Pedidos" data={deliveryData} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>
    </Tabs>
  );
};
