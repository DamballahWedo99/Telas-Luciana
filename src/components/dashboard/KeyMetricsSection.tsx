import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FilterOptions,
  InventoryItem,
  KeyMetricsType,
} from "../../../types/types";

interface KeyMetricsSectionProps {
  inventory: InventoryItem[];
  filters: FilterOptions;
}

export const KeyMetricsSection: React.FC<KeyMetricsSectionProps> = ({
  inventory,
  filters,
}) => {
  const {
    searchTerm,
    unitFilter,
    ocFilter,
    telaFilter,
    colorFilter,
    ubicacionFilter,
  } = filters;

  const metrics = useMemo((): KeyMetricsType => {
    const filteredInventory = inventory.filter((item) => {
      const matchesSearch =
        item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Color.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesUnit = unitFilter === "all" || item.Unidades === unitFilter;

      const matchesOC = ocFilter === "all" || item.OC === ocFilter;

      const matchesTela = telaFilter === "all" || item.Tela === telaFilter;

      const matchesColor = colorFilter === "all" || item.Color === colorFilter;

      const matchesUbicacion =
        ubicacionFilter === "all" || item.Ubicacion === ubicacionFilter;

      return (
        matchesSearch &&
        matchesUnit &&
        matchesOC &&
        matchesTela &&
        matchesColor &&
        matchesUbicacion
      );
    });

    const mtsItems = filteredInventory.filter(
      (item) => item.Unidades === "MTS"
    );
    const kgsItems = filteredInventory.filter(
      (item) => item.Unidades === "KGS"
    );

    const mtsTotalQuantity = mtsItems.reduce(
      (sum, item) => sum + item.Cantidad,
      0
    );
    const mtsTotalCost = mtsItems.reduce((sum, item) => sum + item.Total, 0);

    const kgsTotalQuantity = kgsItems.reduce(
      (sum, item) => sum + item.Cantidad,
      0
    );
    const kgsTotalCost = kgsItems.reduce((sum, item) => sum + item.Total, 0);

    const overallTotalCost = filteredInventory.reduce(
      (sum, item) => sum + item.Total,
      0
    );

    return {
      mts: {
        totalQuantity: mtsTotalQuantity,
        totalCost: mtsTotalCost,
        itemCount: mtsItems.length,
      },
      kgs: {
        totalQuantity: kgsTotalQuantity,
        totalCost: kgsTotalCost,
        itemCount: kgsItems.length,
      },
      overall: {
        totalCost: overallTotalCost,
        itemCount: filteredInventory.length,
      },
    };
  }, [
    inventory,
    searchTerm,
    unitFilter,
    ocFilter,
    telaFilter,
    colorFilter,
    ubicacionFilter,
  ]);

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">MTS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.mts.totalQuantity)} MTS
          </div>
          <p className="text-xs text-muted-foreground">
            ${formatNumber(metrics.mts.totalCost)} en {metrics.mts.itemCount}{" "}
            artículos
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">KGS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(metrics.kgs.totalQuantity)} KGS
          </div>
          <p className="text-xs text-muted-foreground">
            ${formatNumber(metrics.kgs.totalCost)} en {metrics.kgs.itemCount}{" "}
            artículos
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${formatNumber(metrics.overall.totalCost)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total en {metrics.overall.itemCount} artículos
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
