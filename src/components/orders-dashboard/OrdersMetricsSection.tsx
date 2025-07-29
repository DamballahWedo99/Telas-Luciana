import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TotalsData {
  totalFactura: number;
  totalMxp: number;
  gastosMxp: number;
  ddpTotalMxp: number;
}

interface OrdersMetricsSectionProps {
  totals: TotalsData;
  filteredDataLength: number;
}

export const OrdersMetricsSection: React.FC<OrdersMetricsSectionProps> = ({
  totals,
}) => {
  const formatCurrency = (value: number, decimals = 2): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total facturas (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${formatCurrency(totals.totalFactura)}
          </div>
          <p className="text-xs text-muted-foreground">
            Antes de impuestos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total MXP (Pesos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${formatCurrency(totals.totalMxp)}
          </div>
          <p className="text-xs text-muted-foreground">
            Valor en pesos mexicanos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Gastos MXP (Pesos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${formatCurrency(totals.gastosMxp)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total gastos asociados
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">DDP Total (Pesos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${formatCurrency(totals.ddpTotalMxp)}
          </div>
          <p className="text-xs text-muted-foreground">
            Delivered Duty Paid
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
