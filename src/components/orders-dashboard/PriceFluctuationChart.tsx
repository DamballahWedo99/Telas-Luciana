"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PriceFluctuationData {
  date: string;
  [providerKey: string]: number | string | null;
}

interface ProviderStats {
  provider: string;
  totalEntries: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  color: string;
}

interface TooltipPayload {
  value: number;
  name: string;
  color: string;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

interface PriceFluctuationChartProps {
  data: PriceFluctuationData[];
  providers: ProviderStats[];
  fabricName: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Filter out only the providers that have data for this date
    const validEntries = payload.filter(entry => 
      entry.value != null && entry.value !== undefined && typeof entry.value === 'number'
    );

    if (validEntries.length === 0) return null;

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[200px]">
        <p className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
          {new Date(label || "").toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
          })}
        </p>
        <div className="space-y-2">
          {validEntries.map((entry, index) => (
            <div key={index} className="flex items-center justify-between space-x-3">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {entry.name}:
                </span>
              </div>
              <span className="text-sm font-semibold" style={{ color: entry.color }}>
                {new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: 'MXN',
                  minimumFractionDigits: 2,
                }).format(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

const CustomLegend: React.FC<{ providers: ProviderStats[] }> = ({ providers }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4 px-4">
      {providers.map((provider) => (
        <div key={provider.provider} className="flex items-center space-x-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: provider.color }}
          />
          <span className="font-medium">{provider.provider}</span>
          <span className="text-gray-500">
            ({provider.totalEntries} registro{provider.totalEntries !== 1 ? 's' : ''})
          </span>
        </div>
      ))}
    </div>
  );
};

export const PriceFluctuationChart = React.memo<PriceFluctuationChartProps>(({
  data,
  providers,
  fabricName,
}) => {
  // Calculate chart domain for better visualization
  const priceRange = useMemo(() => {
    const allPrices: number[] = [];
    
    data.forEach(point => {
      providers.forEach(provider => {
        const value = point[provider.provider];
        if (typeof value === 'number' && !isNaN(value)) {
          allPrices.push(value);
        }
      });
    });

    if (allPrices.length === 0) return { min: 0, max: 100 };

    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const padding = (max - min) * 0.1; // 10% padding

    return {
      min: Math.max(0, min - padding),
      max: max + padding
    };
  }, [data, providers]);

  // Format date for X-axis
  const formatXAxisDate = (tickItem: string) => {
    try {
      const date = new Date(tickItem);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
      });
    } catch {
      return tickItem;
    }
  };

  // Format price for Y-axis with proper decimal formatting
  const formatYAxisPrice = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  if (!data.length || !providers.length) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <p>No hay datos suficientes para mostrar el gráfico</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" id={`price-fluctuation-chart-${fabricName.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Fluctuación de Precios - {fabricName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Evolución temporal de precios por proveedor
        </p>
      </div>

      <div className="h-96 w-full bg-white rounded-lg p-4" id={`chart-only-${fabricName.replace(/\s+/g, '-').toLowerCase()}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e5e7eb"
              opacity={0.6}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisDate}
              stroke="#6b7280"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={60}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatYAxisPrice}
              stroke="#6b7280"
              fontSize={12}
              domain={[priceRange.min, priceRange.max]}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            
            {providers.map((provider) => (
              <Line
                key={provider.provider}
                type="monotone"
                dataKey={provider.provider}
                stroke={provider.color}
                strokeWidth={2.5}
                dot={{ 
                  fill: provider.color, 
                  strokeWidth: 2, 
                  r: 4,
                  stroke: '#ffffff'
                }}
                activeDot={{ 
                  r: 6, 
                  fill: provider.color,
                  stroke: '#ffffff',
                  strokeWidth: 2
                }}
                connectNulls={true}
                strokeDasharray="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                name={provider.provider}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <CustomLegend providers={providers} />
    </div>
  );
});

PriceFluctuationChart.displayName = 'PriceFluctuationChart';