import React, { useRef, useState } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PieChartIcon,
  DownloadIcon,
  Filter,
} from "lucide-react";
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
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

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
  // Nuevas props para los filtros
  searchQuery?: string;
  ordenDeCompraFilter?: string;
  tipoTelaFilter?: string;
  colorFilter?: string;
  ubicacionFilter?: string;
}

export const OrdersChartsCard: React.FC<OrdersChartsCardProps> = ({
  pieChartData,
  barChartData,
  timelineData,
  deliveryData,
  chartsCollapsed,
  setChartsCollapsed,
  dataLength,
  // Filtros activos
  searchQuery = "",
  ordenDeCompraFilter = "all",
  tipoTelaFilter = "all",
  colorFilter = "all",
  ubicacionFilter = "all",
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("orders");

  // Verificar si algún filtro está activo
  const isFilterActive =
    searchQuery !== "" ||
    ordenDeCompraFilter !== "all" ||
    tipoTelaFilter !== "all" ||
    colorFilter !== "all" ||
    ubicacionFilter !== "all";

  const getTabLabel = (tab: string): string => {
    switch (tab) {
      case "orders":
        return "Órdenes de Compra";
      case "colors":
        return "Distribución por Color";
      case "timeline":
        return "Evolución Mensual";
      case "delivery":
        return "Tiempos de Entrega";
      default:
        return "Visualización";
    }
  };

  // Obtener filtros activos como texto
  const getActiveFiltersText = (): string[] => {
    const filters: string[] = [];

    if (ordenDeCompraFilter && ordenDeCompraFilter !== "all") {
      filters.push(`OC: ${ordenDeCompraFilter}`);
    }

    if (tipoTelaFilter && tipoTelaFilter !== "all") {
      filters.push(`Tela: ${tipoTelaFilter}`);
    }

    if (colorFilter && colorFilter !== "all") {
      filters.push(`Color: ${colorFilter}`);
    }

    if (ubicacionFilter && ubicacionFilter !== "all") {
      const ubicacionText =
        ubicacionFilter === "almacen"
          ? "Almacén"
          : ubicacionFilter === "transito"
          ? "En Tránsito"
          : "Proveedor";
      filters.push(`Ubicación: ${ubicacionText}`);
    }

    if (searchQuery) {
      filters.push(`Búsqueda: ${searchQuery}`);
    }

    return filters;
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;

    try {
      // Mostrar notificación de inicio usando Sonner
      const toastId = toast.loading("Generando PDF...");

      // Encontrar el contenido específico de la pestaña activa
      const activeTabContent = chartRef.current.querySelector(
        `[data-state="active"] .h-80`
      );

      if (!activeTabContent) {
        toast.error("No se pudo encontrar el elemento del gráfico", {
          id: toastId,
        });
        return;
      }

      // Crear un clon del elemento para manipularlo sin afectar la UI
      const clonedElement = activeTabContent.cloneNode(true) as HTMLElement;

      // Eliminar tooltips y elementos no necesarios para el PDF
      const tooltips = clonedElement.querySelectorAll('[role="tooltip"]');
      tooltips.forEach((tooltip) => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });

      // Asegurar que el contenedor del gráfico tenga altura adecuada
      clonedElement.style.height = "500px";
      clonedElement.style.width = "900px";
      clonedElement.style.paddingTop = "20px";

      // Crear un contenedor temporal para el clon
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "1000px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.style.padding = "30px";

      // Añadir título con el nombre de la pestaña activa
      const titleElement = document.createElement("h1");
      titleElement.style.fontSize = "28px";
      titleElement.style.marginBottom = "10px";
      titleElement.style.fontFamily = "Arial, sans-serif";
      titleElement.textContent = getTabLabel(activeTab);

      // Añadir fecha de generación
      const dateElement = document.createElement("p");
      dateElement.style.fontSize = "14px";
      dateElement.style.marginBottom = "10px";
      dateElement.style.fontFamily = "Arial, sans-serif";
      dateElement.style.color = "#666";

      const date = new Date();
      const dateStr = `Generado el: ${date
        .getDate()
        .toString()
        .padStart(2, "0")}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${date.getFullYear()}`;
      dateElement.textContent = dateStr;

      // Añadir información de filtros activos para el PDF - ENFOQUE MEJORADO
      if (isFilterActive) {
        const activeFilters = getActiveFiltersText();
        const filtersText = document.createElement("p");
        filtersText.textContent =
          "Datos filtrados por: " + activeFilters.join(", ");
        filtersText.style.fontSize = "14px";
        filtersText.style.marginBottom = "20px";
        filtersText.style.fontFamily = "Arial, sans-serif";
        filtersText.style.color = "#333";

        tempContainer.appendChild(titleElement);
        tempContainer.appendChild(dateElement);
        tempContainer.appendChild(filtersText);
      } else {
        tempContainer.appendChild(titleElement);
        tempContainer.appendChild(dateElement);
      }

      tempContainer.appendChild(clonedElement);
      document.body.appendChild(tempContainer);

      // Dar tiempo a que los elementos se rendericen correctamente
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Capturar el elemento clonado como imagen
      const canvas = await html2canvas(tempContainer, {
        scale: 2, // Aumenta la escala para mejor calidad
        logging: false,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });

      // Eliminar el contenedor temporal
      document.body.removeChild(tempContainer);

      // Crear un nuevo documento PDF
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Calcular proporciones para mantener el aspecto y centrar en la página
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20; // 10mm de margen a cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const xPosition = 10; // Margen izquierdo de 10mm
      const yPosition = Math.max(5, (pageHeight - imgHeight) / 2); // Centrar verticalmente con mínimo de 5mm

      // Añadir la imagen del gráfico al PDF
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 1.0),
        "JPEG",
        xPosition,
        yPosition,
        imgWidth,
        imgHeight
      );

      // Obtener nombre del archivo basado en la pestaña activa
      const fileName = `pedidos_${activeTab}_${date.getFullYear()}${(
        date.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}.pdf`;

      // Descargar el PDF
      pdf.save(fileName);

      // Actualizar notificación con éxito
      toast.success("PDF descargado correctamente", { id: toastId });
    } catch (error) {
      console.error("Error al generar el PDF:", error);
      // Mostrar notificación de error con Sonner
      toast.error("Error al generar el PDF");
    }
  };

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
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownloadPDF}
                  disabled={chartsCollapsed || dataLength === 0}
                >
                  <DownloadIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Descargar como PDF</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

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
        </div>
      </CardHeader>

      {!chartsCollapsed && (
        <CardContent>
          <div ref={chartRef}>
            {dataLength > 0 ? (
              <>
                <PedidosCharts
                  pieChartData={pieChartData}
                  barChartData={barChartData}
                  timelineData={timelineData}
                  deliveryData={deliveryData}
                  onTabChange={setActiveTab}
                />

                {/* Nueva sección de filtros activos */}
                {isFilterActive && (
                  <div className="flex items-center gap-2 text-sm mt-4 pt-3 border-t">
                    <Filter size={16} className="text-gray-500" />
                    <span className="text-gray-500">Datos filtrados por:</span>
                    <div className="flex flex-wrap gap-2">
                      {ordenDeCompraFilter && ordenDeCompraFilter !== "all" && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                          OC: {ordenDeCompraFilter}
                        </span>
                      )}
                      {tipoTelaFilter && tipoTelaFilter !== "all" && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                          Tela: {tipoTelaFilter}
                        </span>
                      )}
                      {colorFilter && colorFilter !== "all" && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                          Color: {colorFilter}
                        </span>
                      )}
                      {ubicacionFilter && ubicacionFilter !== "all" && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                          Ubicación:{" "}
                          {ubicacionFilter === "almacen"
                            ? "Almacén"
                            : ubicacionFilter === "transito"
                            ? "En Tránsito"
                            : "Proveedor"}
                        </span>
                      )}
                      {searchQuery && (
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
                          Búsqueda: {searchQuery}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
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
          </div>
        </CardContent>
      )}
    </Card>
  );
};
