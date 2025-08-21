"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
} from "lucide-react";
import type { ProviderPriceData, ProviderColumn } from "@/types/price-history";
import {
  getTrendColor,
  formatTableDate,
  formatFullDate,
  formatCurrency,
} from "@/hooks/usePriceHistory";

interface ProviderCellProps {
  data: ProviderPriceData | null;
  className?: string;
  fabricId: string;
  forceExpanded?: boolean;
}

export const ProviderCell: React.FC<ProviderCellProps> = ({
  data,
  className = "",
  fabricId,
  forceExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use forceExpanded when provided, otherwise use local state
  const shouldExpand = forceExpanded || isExpanded;

  if (!data) {
    return (
      <div className={`text-center text-gray-400 p-2 ${className}`}>
        <div className="text-xs">—</div>
        <div className="text-xs">—</div>
      </div>
    );
  }

  const getTrendDisplay = (
    trend?: "up" | "down" | "stable",
    changePercent?: number
  ) => {
    if (!trend || trend === "stable") {
      return (
        <div className="flex items-center justify-center gap-1 text-gray-500">
          <Minus className="h-3 w-3" />
        </div>
      );
    }

    const Icon = trend === "up" ? TrendingUp : TrendingDown;
    const color = getTrendColor(trend);

    return (
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        <Icon className="h-3 w-3" />
        {changePercent !== undefined && (
          <span className="text-xs font-medium">
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </span>
        )}
      </div>
    );
  };

  const hasMultipleEntries = data.allEntries && data.allEntries.length > 1;

  return (
    <div className={`text-center ${className}`}>
      {/* Main latest entry display */}
      <div className="p-2">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
          {formatTableDate(data.date)}
        </div>
        <div className="font-medium text-sm">{formatCurrency(data.price)}</div>
        <div className="mt-0.5">
          {getTrendDisplay(data.trend, data.changePercent)}
        </div>

        {/* Show expansion button if there are multiple entries */}
        {hasMultipleEntries && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            <Layers className="h-3 w-3" />
            <span>{data.totalEntries || 0} entradas</span>
            {shouldExpand ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Expanded historical entries */}
      {shouldExpand && hasMultipleEntries && (
        <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Historial Completo
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 pb-2">
            {data.allEntries?.map((entry, index) => {
              const isLatest = index === 0;
              const previousEntry = data.allEntries?.[index + 1];

              // Calculate trend for this entry vs previous
              let entryTrend: "up" | "down" | "stable" = "stable";
              let entryChangePercent = 0;

              if (
                previousEntry &&
                entry.quantity > 0 &&
                previousEntry.quantity > 0
              ) {
                const change = entry.quantity - previousEntry.quantity;
                entryChangePercent = (change / previousEntry.quantity) * 100;

                if (entryChangePercent > 1) entryTrend = "up";
                else if (entryChangePercent < -1) entryTrend = "down";
              }

              return (
                <div
                  key={`${fabricId}-${entry.provider || "unknown"}-${entry.date || "no-date"}-${entry.quantity || 0}-${index}`}
                  className={`p-2 rounded text-xs border ${
                    isLatest
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div
                      className={`font-medium ${isLatest ? "text-blue-700 dark:text-blue-300" : ""}`}
                    >
                      {formatFullDate(entry.date)}
                    </div>
                    {isLatest && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded">
                        Actual
                      </span>
                    )}
                  </div>
                  <div
                    className={`font-semibold ${isLatest ? "text-blue-700 dark:text-blue-300" : ""}`}
                  >
                    {formatCurrency(entry.quantity)}
                  </div>
                  {!isLatest && previousEntry && (
                    <div className="mt-1">
                      {getTrendDisplay(entryTrend, entryChangePercent)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ProviderHeaderProps {
  provider: ProviderColumn;
  onSort?: (providerId: string) => void;
  sortedBy?: string;
  sortOrder?: "asc" | "desc";
}

export const ProviderHeader: React.FC<ProviderHeaderProps> = ({
  provider,
  onSort,
}) => {
  return (
    <th className="min-w-[120px] border-r border-gray-200 dark:border-gray-700 last:border-r-0 bg-gray-50 dark:bg-gray-800">
      <div className="px-3 py-2">
        <button
          onClick={() => onSort?.(provider.id)}
          className="flex flex-col items-center gap-1 w-full hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <div className="font-semibold text-sm">{provider.name}</div>
          {provider.hasData && (
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span>{provider.totalFabrics} telas</span>
            </div>
          )}
        </button>
      </div>
    </th>
  );
};
