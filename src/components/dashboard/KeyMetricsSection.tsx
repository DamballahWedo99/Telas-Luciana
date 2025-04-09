import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryItem } from "../../../types/types";

interface KeyMetricsSectionProps {
  inventory: InventoryItem[];
}

const formatNumber = (num: number) => {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const KeyMetricsSection: React.FC<KeyMetricsSectionProps> = ({
  inventory,
}) => {
  const keyMetrics = useMemo(() => {
    const mtsItems = inventory.filter((item) => item.Unidades === "MTS");
    const kgsItems = inventory.filter((item) => item.Unidades === "KGS");

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
        totalCost: inventory.reduce((sum, item) => sum + item.Total, 0),
        itemCount: inventory.length,
      },
    };
  }, [inventory]);

  const isAdmin = true;

  return (
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
              Costo Total General: ${formatNumber(keyMetrics.overall.totalCost)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
