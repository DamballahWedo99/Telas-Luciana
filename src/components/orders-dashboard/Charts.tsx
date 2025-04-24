import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChartDataItem {
  name: string;
  value: number;
}

interface BarChartDataItem {
  name: string;
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
}

export const PedidosCharts: React.FC<PedidosChartsProps> = ({
  pieChartData,
  barChartData,
  timelineData,
  deliveryData,
}) => {
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

  return (
    <Tabs defaultValue="orders" className="w-full">
      <TabsList className="grid grid-cols-4 mb-4">
        <TabsTrigger value="orders">Órdenes de Compra</TabsTrigger>
        <TabsTrigger value="colors">Distribución por Color</TabsTrigger>
        <TabsTrigger value="timeline">Evolución Mensual</TabsTrigger>
        <TabsTrigger value="delivery">Tiempos de Entrega</TabsTrigger>
      </TabsList>

      {/* Tab: Órdenes de Compra */}
      <TabsContent value="orders" className="mt-4">
        <div className="h-80 w-full bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">
            Top Órdenes de Compra por Total Factura
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={barChartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                axisLine={false}
                tickLine={false}
              />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [
                  `${formatCurrency(value)}`,
                  "Total Factura",
                ]}
                contentStyle={{ borderRadius: "8px" }}
              />
              <Legend />
              <Bar
                dataKey="total"
                fill="#0088FE"
                name="Total Factura (USD)"
                radius={[4, 4, 0, 0]}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Tab: Distribución por Color */}
      <TabsContent value="colors" className="mt-4">
        <div className="h-80 w-full bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Distribución por Color</h3>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                labelLine={true}
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `${formatCurrency(value)}`,
                  "Total Factura",
                ]}
                contentStyle={{ borderRadius: "8px" }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Tab: Evolución Mensual */}
      <TabsContent value="timeline" className="mt-4">
        <div className="h-80 w-full bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">
            Evolución de Pedidos por Mes
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timelineData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "count"
                    ? value.toString()
                    : `$${formatCurrency(value)}`,
                  name === "count" ? "Cantidad de Pedidos" : "Total Facturado",
                ]}
                contentStyle={{ borderRadius: "8px" }}
              />
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
        <div className="h-80 w-full bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">
            Análisis de Tiempos de Entrega
          </h3>
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
