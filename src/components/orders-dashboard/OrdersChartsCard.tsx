import React from "react";
import { ChevronUpIcon, ChevronDownIcon, PieChartIcon } from "lucide-react";
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
import { PedidosCharts } from "./Charts";

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

interface OrdersChartsCardProps {
  pieChartData: ChartDataItem[];
  barChartData: BarChartDataItem[];
  timelineData: TimelineDataItem[];
  deliveryData: DeliveryDataItem[];
  chartsCollapsed: boolean;
  setChartsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  dataLength: number;
}

export const OrdersChartsCard: React.FC<OrdersChartsCardProps> = ({
  pieChartData,
  barChartData,
  timelineData,
  deliveryData,
  chartsCollapsed,
  setChartsCollapsed,
  dataLength,
}) => {
  return (
    <Card className="mb-6 shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center mb-1">
            <PieChartIcon className="mr-2 h-5 w-5" />
            Visualizaciones
          </CardTitle>
          <CardDescription>
            Análisis gráfico de los datos de pedidos
          </CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChartsCollapsed(!chartsCollapsed)}
              >
                {chartsCollapsed ? (
                  <ChevronDownIcon className="h-5 w-5" />
                ) : (
                  <ChevronUpIcon className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{chartsCollapsed ? "Expandir" : "Colapsar"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      {!chartsCollapsed && (
        <CardContent>
          {dataLength > 0 ? (
            <PedidosCharts
              pieChartData={pieChartData}
              barChartData={barChartData}
              timelineData={timelineData}
              deliveryData={deliveryData}
            />
          ) : (
            <div className="bg-white p-8 rounded shadow-sm flex flex-col items-center justify-center">
              <h3 className="text-lg font-semibold mb-2">
                No hay datos para mostrar
              </h3>
              <p className="text-gray-500 mb-4 text-center">
                No se encontraron datos para visualizar. Intenta cargar un
                archivo con más datos.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
