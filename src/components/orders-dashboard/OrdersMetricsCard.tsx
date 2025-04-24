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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  filteredDataLength,
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
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="usd">USD</TabsTrigger>
              <TabsTrigger value="mxn">MXN</TabsTrigger>
              <TabsTrigger value="costs">Costos</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    Total Facturas
                  </h3>
                  <p className="text-2xl font-bold">
                    ${formatCurrency(totals.totalFactura)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    Total MXP
                  </h3>
                  <p className="text-2xl font-bold">
                    $MXN {formatCurrency(totals.totalMxp)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    Gastos MXP
                  </h3>
                  <p className="text-2xl font-bold">
                    $MXN {formatCurrency(totals.gastosMxp)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    DDP Total
                  </h3>
                  <p className="text-2xl font-bold">
                    $MXN {formatCurrency(totals.ddpTotalMxp)}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="usd">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    Total Factura (USD)
                  </h3>
                  <p className="text-2xl font-bold">
                    ${formatCurrency(totals.totalFactura)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total en dólares antes de impuestos
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    Promedio por Pedido
                  </h3>
                  <p className="text-2xl font-bold">
                    $
                    {formatCurrency(
                      filteredDataLength
                        ? totals.totalFactura / filteredDataLength
                        : 0
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Promedio de factura por pedido
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mxn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    Total MXP
                  </h3>
                  <p className="text-2xl font-bold">
                    $MXN {formatCurrency(totals.totalMxp)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total en pesos mexicanos
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    DDP Total MXP
                  </h3>
                  <p className="text-2xl font-bold">
                    $MXN {formatCurrency(totals.ddpTotalMxp)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Delivered Duty Paid total en MXN
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="costs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    Gastos MXP
                  </h3>
                  <p className="text-2xl font-bold">
                    $MXN {formatCurrency(totals.gastosMxp)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total de gastos en pesos mexicanos
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500">
                    % Gastos
                  </h3>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      totals.totalMxp > 0
                        ? (totals.gastosMxp / totals.totalMxp) * 100
                        : 0
                    )}
                    %
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Porcentaje de gastos sobre el total
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
};
