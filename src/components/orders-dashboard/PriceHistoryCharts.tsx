"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ScatterChart,
  Scatter,
} from "recharts";
import type { FabricPriceHistory, PriceHistorySummary } from "@/types/price-history";
import { getTrendColor, getTrendIcon } from "@/hooks/usePriceHistory";

interface PriceHistoryChartsProps {
  fabrics: FabricPriceHistory[];
  summary: PriceHistorySummary[];
}

interface ChartDataPoint {
  date: string;
  [key: string]: number | string;
}

interface TooltipPayload {
  value: number;
  name: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: ${entry.value.toFixed(2)} / kg
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const PriceHistoryCharts: React.FC<PriceHistoryChartsProps> = ({
  fabrics,
  summary,
}) => {
  const lineChartData = useMemo(() => {
    const dataMap: Record<string, ChartDataPoint> = {};
    
    fabrics.forEach((fabric) => {
      fabric.history.forEach((entry) => {
        const dateKey = new Date(entry.date).toLocaleDateString("es-MX");
        
        if (!dataMap[dateKey]) {
          dataMap[dateKey] = { date: dateKey };
        }
        
        dataMap[dateKey][fabric.fabricName] = entry.quantity;
      });
    });

    return Object.values(dataMap)
      .sort((a, b) => {
        const dateA = new Date(a.date.split("/").reverse().join("-"));
        const dateB = new Date(b.date.split("/").reverse().join("-"));
        return dateA.getTime() - dateB.getTime();
      });
  }, [fabrics]);

  const trendData = useMemo(() => {
    return summary.map((item) => ({
      fabric: item.fabricName,
      current: item.currentPrice,
      previous: item.previousPrice,
      change: item.priceChange,
      changePercent: item.priceChangePercent,
      trend: item.trend,
    }));
  }, [summary]);

  const priceRangeData = useMemo(() => {
    return summary.map((item) => ({
      fabric: item.fabricName,
      min: item.minPrice,
      avg: item.avgPrice,
      max: item.maxPrice,
      current: item.currentPrice,
    }));
  }, [summary]);

  const scatterData = useMemo(() => {
    const data: Array<{ date: number; price: number; fabric: string }> = [];
    
    fabrics.forEach((fabric) => {
      fabric.history.forEach((entry) => {
        data.push({
          date: new Date(entry.date).getTime(),
          price: entry.quantity,
          fabric: fabric.fabricName,
        });
      });
    });
    
    return data;
  }, [fabrics]);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Evolución de Precios</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={lineChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              label={{ value: "Precio ($/kg)", angle: -90, position: "insideLeft" }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            {fabrics.map((fabric, index) => (
              <Line
                key={fabric.fabricId}
                type="monotone"
                dataKey={fabric.fabricName}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Tendencias Actuales</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fabric" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => `$${value.toFixed(2)}`}
                labelFormatter={(label) => `Tela: ${label}`}
              />
              <Bar dataKey="current" fill="#3b82f6" name="Precio Actual" />
              <Bar dataKey="previous" fill="#94a3b8" name="Precio Anterior" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {trendData.map((item) => (
              <div
                key={item.fabric}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{item.fabric}</span>
                <span className={getTrendColor(item.trend)}>
                  {getTrendIcon(item.trend)} {item.changePercent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Rango de Precios</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={priceRangeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fabric" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => `$${value.toFixed(2)}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="max"
                stackId="1"
                stroke="#ef4444"
                fill="#fca5a5"
                name="Máximo"
              />
              <Area
                type="monotone"
                dataKey="avg"
                stackId="2"
                stroke="#3b82f6"
                fill="#93c5fd"
                name="Promedio"
              />
              <Area
                type="monotone"
                dataKey="min"
                stackId="3"
                stroke="#10b981"
                fill="#86efac"
                name="Mínimo"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {scatterData.length > 0 && scatterData.length < 500 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Distribución de Precios en el Tiempo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                domain={["dataMin", "dataMax"]}
                name="Fecha"
                tickFormatter={(tick) => new Date(tick).toLocaleDateString("es-MX")}
                type="number"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                dataKey="price"
                name="Precio"
                tick={{ fontSize: 12 }}
                label={{ value: "Precio ($/kg)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number | string, name: string) => {
                  if (name === "date" && typeof value === 'number') {
                    return new Date(value).toLocaleDateString("es-MX");
                  }
                  if (name === "price" && typeof value === 'number') {
                    return `$${value.toFixed(2)}`;
                  }
                  return value;
                }}
              />
              {fabrics.map((fabric, index) => {
                const fabricData = scatterData.filter(d => d.fabric === fabric.fabricName);
                return (
                  <Scatter
                    key={fabric.fabricId}
                    name={fabric.fabricName}
                    data={fabricData}
                    fill={COLORS[index % COLORS.length]}
                  />
                );
              })}
              <Legend />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};