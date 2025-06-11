import React from "react";
import { ChevronUpIcon, ChevronDownIcon, BarChart3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TotalsData {
  totalFactura: number;
  totalMxp: number;
  gastosMxp: number;
  ddpTotalMxp: number;
}

interface OrdersMetricsCardProps {
  totals: TotalsData;
  filteredDataLength: number;
  metricsCollapsed: boolean;
  setMetricsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export const OrdersMetricsCard: React.FC<OrdersMetricsCardProps> = ({
  totals,
  metricsCollapsed,
  setMetricsCollapsed,
}) => {
  const formatCurrency = (value: number, decimals = 2): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  return (
    <Card className="mb-6 shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center mb-1">
            <BarChart3Icon className="mr-2 h-5 w-5" />
            Métricas Principales
          </CardTitle>
          <CardDescription>Resumen financiero de los pedidos</CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMetricsCollapsed(!metricsCollapsed)}
              >
                {metricsCollapsed ? (
                  <ChevronDownIcon className="h-5 w-5" />
                ) : (
                  <ChevronUpIcon className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{metricsCollapsed ? "Expandir" : "Colapsar"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      {!metricsCollapsed && (
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg shadow-sm border border-blue-200">
              <h3 className="text-sm font-medium text-blue-700 mb-1">
                Total Facturas
              </h3>
              <p className="text-2xl font-bold text-blue-900">
                ${formatCurrency(totals.totalFactura)}
              </p>
              <p className="text-xs text-blue-600 mt-2 opacity-80">
                USD antes de impuestos
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-lg shadow-sm border border-green-200">
              <h3 className="text-sm font-medium text-green-700 mb-1">
                Total MXP
              </h3>
              <p className="text-2xl font-bold text-green-900">
                $MXN {formatCurrency(totals.totalMxp)}
              </p>
              <p className="text-xs text-green-600 mt-2 opacity-80">
                Valor en pesos mexicanos
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-lg shadow-sm border border-amber-200">
              <h3 className="text-sm font-medium text-amber-700 mb-1">
                Gastos MXP
              </h3>
              <p className="text-2xl font-bold text-amber-900">
                $MXN {formatCurrency(totals.gastosMxp)}
              </p>
              <p className="text-xs text-amber-600 mt-2 opacity-80">
                Total gastos asociados
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg shadow-sm border border-purple-200">
              <h3 className="text-sm font-medium text-purple-700 mb-1">
                DDP Total
              </h3>
              <p className="text-2xl font-bold text-purple-900">
                $MXN {formatCurrency(totals.ddpTotalMxp)}
              </p>
              <p className="text-xs text-purple-600 mt-2 opacity-80">
                Delivered Duty Paid
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
