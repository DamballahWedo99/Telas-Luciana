import React, { useState, useMemo, useRef } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  BarChart3Icon,
  DownloadIcon,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  InventoryItem,
  FabricCostData,
  FilterOptions,
} from "../../../types/types";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface VisualizationsCardProps {
  inventory: InventoryItem[];
  filters: FilterOptions;
}

export const VisualizationsCard: React.FC<VisualizationsCardProps> = ({
  inventory,
  filters,
}) => {
  const [visualizationsCollapsed, setVisualizationsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState("units");
  const chartRef = useRef<HTMLDivElement>(null);

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const { searchTerm, unitFilter, ocFilter, telaFilter, colorFilter } =
          filters;

        const matchesSearch =
          item.OC.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Tela.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Color.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;
        const matchesOC = ocFilter === "all" || item.OC === ocFilter;
        const matchesTela = telaFilter === "all" || item.Tela === telaFilter;
        const matchesColor =
          colorFilter === "all" || item.Color === colorFilter;

        return (
          matchesSearch &&
          matchesUnit &&
          matchesOC &&
          matchesTela &&
          matchesColor
        );
      }),
    [inventory, filters]
  );

  const chartData = useMemo(
    () => [
      {
        name: "MTS",
        value: filteredInventory
          .filter((item) => item.Unidades === "MTS")
          .reduce((sum, item) => sum + item.Cantidad, 0),
      },
      {
        name: "KGS",
        value: filteredInventory
          .filter((item) => item.Unidades === "KGS")
          .reduce((sum, item) => sum + item.Cantidad, 0),
      },
    ],
    [filteredInventory]
  );

  const visualizationData = useMemo(() => {
    const fabricValueData = Object.entries(
      filteredInventory.reduce((acc, item) => {
        const key = item.Tela as string;
        acc[key] = (acc[key] || 0) + item.Total;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const colorQuantityData = Object.entries(
      filteredInventory.reduce((acc, item) => {
        const key = item.Color as string;
        acc[key] = (acc[key] || 0) + item.Cantidad;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const ocValueData = Object.entries(
      filteredInventory.reduce((acc, item) => {
        const key = item.OC as string;
        acc[key] = (acc[key] || 0) + item.Total;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const fabricCostData: FabricCostData = {
      MTS: filteredInventory
        .filter((item) => item.Unidades === "MTS")
        .map((item) => ({
          x: item.Costo,
          y: item.Cantidad,
          z: item.Tela,
          size: item.Total,
        })),
      KGS: filteredInventory
        .filter((item) => item.Unidades === "KGS")
        .map((item) => ({
          x: item.Costo,
          y: item.Cantidad,
          z: item.Tela,
          size: item.Total,
        })),
    };

    const groupedInventory = filteredInventory.reduce((acc, item) => {
      const key = `${item.Tela}-${item.Color}`;
      if (!acc[key]) {
        acc[key] = {
          tela: item.Tela,
          color: item.Color,
          cantidad: 0,
          costo: 0,
        };
      }
      acc[key].cantidad += item.Cantidad;
      acc[key].costo += item.Costo;
      return acc;
    }, {} as Record<string, { tela: string; color: string; cantidad: number; costo: number }>);

    const costDistribution = Object.values(groupedInventory)
      .sort((a, b) => b.costo - a.costo)
      .map((item) => ({
        name: `${item.tela} (${item.color})`,
        value: item.costo,
      }));

    const turnoverData = Object.values(groupedInventory)
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((item) => ({
        name: `${item.tela} (${item.color})`,
        value: item.cantidad,
      }));

    const fabricColorData = Object.values(groupedInventory)
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((item) => ({
        tela: item.tela,
        color: item.color,
        value: item.cantidad,
      }));

    return {
      fabricValueData,
      colorQuantityData,
      ocValueData,
      fabricCostData,
      costDistribution,
      turnoverData,
      fabricColorData,
    };
  }, [filteredInventory]);

  const COLORS = [
    "#4299E1", // azul
    "#48BB78", // verde
    "#F6AD55", // naranja
    "#F56565", // rojo
    "#9F7AEA", // morado
    "#38B2AC", // turquesa
    "#667EEA", // indigo
    "#ED64A6", // rosa
    "#ECC94B", // amarillo
    "#81E6D9", // teal claro
    "#D53F8C", // rosa fuerte
    "#2B6CB0", // azul oscuro
    "#68D391", // verde claro
    "#FC8181", // rosa salmón
    "#B794F4", // lavanda
  ];

  // Verificar si algún filtro está activo
  const isFilterActive =
    filters.searchTerm !== "" ||
    filters.unitFilter !== "all" ||
    filters.ocFilter !== "all" ||
    filters.telaFilter !== "all" ||
    filters.colorFilter !== "all";

  // Obtener filtros activos como texto
  const getActiveFiltersText = (): string[] => {
    const activeFilters: string[] = [];

    if (filters.unitFilter !== "all") {
      activeFilters.push(`Unidad: ${filters.unitFilter}`);
    }

    if (filters.ocFilter !== "all") {
      activeFilters.push(`OC: ${filters.ocFilter}`);
    }

    if (filters.telaFilter !== "all") {
      activeFilters.push(`Tela: ${filters.telaFilter}`);
    }

    if (filters.colorFilter !== "all") {
      activeFilters.push(`Color: ${filters.colorFilter}`);
    }

    if (filters.searchTerm) {
      activeFilters.push(`Búsqueda: ${filters.searchTerm}`);
    }

    return activeFilters;
  };

  // Función para obtener el nombre de la pestaña
  const getTabLabel = (tab: string): string => {
    switch (tab) {
      case "units":
        return "Resumen por Unidades";
      case "fabric":
        return "Valor por Tipo de Tela";
      case "color":
        return "Cantidad por Color";
      case "orders":
        return "Valor por Orden de Compra";
      case "costs":
        return "Análisis de Costo Unitario vs Cantidad";
      default:
        return "Visualización de Inventario";
    }
  };

  // Función para generar PDF específico para la visualización de Telas
  const handleDownloadFabricPDF = async () => {
    try {
      const toastId = toast.loading("Generando PDF de Telas...");

      // Crear un contenedor temporal para la visualización de telas
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "800px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.style.padding = "30px";

      // Añadir título y fecha
      const titleElement = document.createElement("h1");
      titleElement.style.fontSize = "28px";
      titleElement.style.marginBottom = "10px";
      titleElement.style.fontFamily = "Arial, sans-serif";
      titleElement.textContent = "Valor por Tipo de Tela";

      const dateElement = document.createElement("p");
      dateElement.style.fontSize = "14px";
      dateElement.style.marginBottom = "20px";
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

      tempContainer.appendChild(titleElement);
      tempContainer.appendChild(dateElement);

      // Añadir filtros activos si existen
      if (isFilterActive) {
        const activeFilters = getActiveFiltersText();
        const filtersText = document.createElement("p");
        filtersText.textContent =
          "Datos filtrados por: " + activeFilters.join(", ");
        filtersText.style.fontSize = "14px";
        filtersText.style.marginBottom = "20px";
        filtersText.style.fontFamily = "Arial, sans-serif";
        filtersText.style.color = "#333";
        tempContainer.appendChild(filtersText);
      }

      // Crear contenedor para las barras
      const barsContainer = document.createElement("div");
      barsContainer.style.marginTop = "20px";

      // Ordenar los datos por valor
      const sortedData = [...visualizationData.fabricValueData].sort(
        (a, b) => b.value - a.value
      );

      // Obtener el valor máximo para calcular porcentajes
      const maxValue = Math.max(...sortedData.map((item) => item.value));
      const totalValue = sortedData.reduce((sum, item) => sum + item.value, 0);

      // Generar las barras para el PDF
      sortedData.forEach((item, index) => {
        const itemContainer = document.createElement("div");
        itemContainer.style.marginBottom = "15px";

        const labelContainer = document.createElement("div");
        labelContainer.style.display = "flex";
        labelContainer.style.justifyContent = "space-between";
        labelContainer.style.marginBottom = "4px";

        const nameLabel = document.createElement("span");
        nameLabel.style.fontFamily = "Arial, sans-serif";
        nameLabel.style.fontSize = "14px";
        nameLabel.style.fontWeight = "bold";
        nameLabel.textContent = item.name;

        const valueLabel = document.createElement("span");
        valueLabel.style.fontFamily = "Arial, sans-serif";
        valueLabel.style.fontSize = "14px";
        valueLabel.style.fontWeight = "bold";
        valueLabel.textContent = `$${formatNumber(item.value)}`;

        labelContainer.appendChild(nameLabel);
        labelContainer.appendChild(valueLabel);

        const barContainer = document.createElement("div");
        barContainer.style.width = "100%";
        barContainer.style.height = "25px";
        barContainer.style.backgroundColor = "#f0f0f0";
        barContainer.style.borderRadius = "4px";
        barContainer.style.overflow = "hidden";

        const bar = document.createElement("div");
        const percentage = (item.value / maxValue) * 100;
        bar.style.width = `${percentage}%`;
        bar.style.height = "100%";
        bar.style.backgroundColor = COLORS[index % COLORS.length];
        bar.style.borderRadius = "4px";
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.paddingLeft = "8px";

        const percentText = document.createElement("span");
        percentText.style.color = "white";
        percentText.style.fontSize = "12px";
        percentText.style.fontWeight = "bold";
        percentText.textContent = `${Math.round(
          (item.value / totalValue) * 100
        )}%`;

        bar.appendChild(percentText);
        barContainer.appendChild(bar);

        itemContainer.appendChild(labelContainer);
        itemContainer.appendChild(barContainer);
        barsContainer.appendChild(itemContainer);
      });

      tempContainer.appendChild(barsContainer);
      document.body.appendChild(tempContainer);

      // Esperar a que los elementos se rendericen
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capturar como imagen
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        logging: false,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });

      // Eliminar el contenedor temporal
      document.body.removeChild(tempContainer);

      // Crear PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Calcular proporciones para mantener el aspecto
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Añadir la imagen al PDF
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 1.0),
        "JPEG",
        10,
        10,
        imgWidth,
        imgHeight
      );

      // Añadir paginación si es necesario
      if (imgHeight > pdf.internal.pageSize.getHeight() - 20) {
        let heightLeft = imgHeight;
        let position = 10;
        let page = 1;

        while (heightLeft > 0) {
          position = heightLeft - pdf.internal.pageSize.getHeight() + 10;
          if (page > 1) {
            pdf.addPage();
            pdf.addImage(
              canvas.toDataURL("image/jpeg", 1.0),
              "JPEG",
              10,
              10 - position,
              imgWidth,
              imgHeight
            );
          }
          heightLeft -= pdf.internal.pageSize.getHeight() - 10;
          page++;
        }
      }

      // Descargar PDF
      const fileName = `telas_valor_${date.getFullYear()}${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}.pdf`;

      pdf.save(fileName);
      toast.success("PDF de Telas descargado correctamente", { id: toastId });
    } catch (error) {
      console.error("Error al generar el PDF de Telas:", error);
      toast.error("Error al generar el PDF de Telas");
    }
  };

  // Función para descargar PDF para las pestañas regulares
  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;

    // Si estamos en la pestaña de telas, usar la función especializada
    if (activeTab === "fabric") {
      handleDownloadFabricPDF();
      return;
    }

    try {
      // Mostrar notificación de inicio
      const toastId = toast.loading("Generando PDF...");

      // Encontrar el contenido específico de la pestaña activa
      const activeTabContent = chartRef.current.querySelector(
        `[data-state="active"] .h-\\[400px\\]`
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
      clonedElement.style.overflow = "visible";

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

      // Añadir información de filtros activos para el PDF
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
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capturar el elemento clonado como imagen
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
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
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const xPosition = 10;
      const yPosition = Math.max(5, (pageHeight - imgHeight) / 2);

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
      const fileName = `inventario_${activeTab}_${date.getFullYear()}${(
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
      toast.error("Error al generar el PDF");
    }
  };

  const hasData = filteredInventory.length > 0;

  const NoDataMessage = () => (
    <div className="flex items-center justify-center w-full h-full p-8">
      <p className="text-muted-foreground text-center">
        No hay datos suficientes para mostrar la gráfica. Carga datos o modifica
        los filtros.
      </p>
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center mb-1">
            <BarChart3Icon className="mr-2 h-5 w-5" />
            Visualizaciones
          </CardTitle>
          <CardDescription>
            Análisis gráfico de los datos de inventario
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownloadPDF}
                  disabled={visualizationsCollapsed || !hasData}
                >
                  <DownloadIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Descargar como PDF</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>

          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setVisualizationsCollapsed(!visualizationsCollapsed)
                  }
                >
                  {visualizationsCollapsed ? (
                    <ChevronDownIcon className="h-5 w-5" />
                  ) : (
                    <ChevronUpIcon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{visualizationsCollapsed ? "Expandir" : "Colapsar"}</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!visualizationsCollapsed && (
        <CardContent>
          <div ref={chartRef}>
            <Tabs defaultValue="units" onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-4">
                <TabsTrigger value="units">Unidades</TabsTrigger>
                <TabsTrigger value="fabric">Telas</TabsTrigger>
                <TabsTrigger value="color">Colores</TabsTrigger>
                <TabsTrigger value="orders">Órdenes</TabsTrigger>
                <TabsTrigger value="costs">Costos</TabsTrigger>
              </TabsList>

              {/* Resumen por Unidades */}
              <TabsContent value="units">
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen por Unidades</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {chartData.some((item) => item.value > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart width={600} height={300} data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: number) => [
                              formatNumber(value),
                              "Cantidad",
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="value" fill="#2980b9" name="Cantidad" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Valor por Tipo de Tela */}
              <TabsContent value="fabric">
                <Card>
                  <CardHeader>
                    <CardTitle>Valor por Tipo de Tela</CardTitle>
                  </CardHeader>
                  <CardContent
                    className={`overflow-y-auto pr-4 ${
                      visualizationData.fabricValueData.length > 0
                        ? visualizationData.fabricValueData.length <= 5
                          ? "h-auto min-h-[300px] max-h-[350px]"
                          : "h-[500px]"
                        : "h-[300px]"
                    }`}
                  >
                    {visualizationData.fabricValueData.length > 0 ? (
                      <div className="w-full">
                        {visualizationData.fabricValueData
                          .sort((a, b) => b.value - a.value)
                          .map((item, index) => (
                            <div key={`fabric-${index}`} className="mb-4">
                              <div className="flex justify-between items-center mb-1">
                                <span
                                  className="font-medium text-sm truncate max-w-[200px]"
                                  title={item.name}
                                >
                                  {item.name}
                                </span>
                                <span className="text-sm font-semibold">
                                  ${formatNumber(item.value)}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                                <div
                                  className={`h-full rounded-full flex items-center pl-2 text-xs text-white font-medium`}
                                  style={{
                                    width: `${Math.max(
                                      (item.value /
                                        Math.max(
                                          ...visualizationData.fabricValueData.map(
                                            (d) => d.value
                                          )
                                        )) *
                                        100,
                                      5
                                    )}%`,
                                    backgroundColor:
                                      COLORS[index % COLORS.length],
                                  }}
                                >
                                  {Math.round(
                                    (item.value /
                                      visualizationData.fabricValueData.reduce(
                                        (sum, d) => sum + d.value,
                                        0
                                      )) *
                                      100
                                  )}
                                  %
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cantidad por Color */}
              <TabsContent value="color">
                <Card>
                  <CardHeader>
                    <CardTitle>Cantidad por Color</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.colorQuantityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visualizationData.colorQuantityData.slice(
                            0,
                            10
                          )}
                          layout="vertical"
                          margin={{
                            top: 20,
                            right: 30,
                            left: 80,
                            bottom: 20,
                          }}
                          barSize={30}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={true}
                            vertical={false}
                          />
                          <XAxis
                            type="number"
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => formatNumber(value)}
                            domain={[0, "dataMax"]}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            width={90}
                            tick={{ fontSize: 14, fontWeight: 500 }}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              formatNumber(value),
                              "Cantidad",
                            ]}
                          />
                          <Legend />
                          <Bar
                            dataKey="value"
                            fill="#8884d8"
                            name="Cantidad"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Valor por Orden de Compra */}
              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <CardTitle>Valor por Orden de Compra</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.ocValueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visualizationData.ocValueData.slice(0, 10)}
                          layout="vertical"
                          margin={{
                            top: 20,
                            right: 30,
                            left: 80,
                            bottom: 20,
                          }}
                          barSize={30}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={true}
                            vertical={false}
                          />
                          <XAxis
                            type="number"
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `$${formatNumber(value)}`}
                            domain={[0, "dataMax"]}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            width={90}
                            tick={{ fontSize: 14, fontWeight: 500 }}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              `$${formatNumber(value)}`,
                              "Valor",
                            ]}
                          />
                          <Legend />
                          <Bar
                            dataKey="value"
                            fill="#82ca9d"
                            name="Valor"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Análisis de Costo Unitario vs Cantidad */}
              <TabsContent value="costs">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Análisis de Costo Unitario vs Cantidad
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {visualizationData.fabricCostData.MTS.length > 0 ||
                    visualizationData.fabricCostData.KGS.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                          margin={{
                            top: 20,
                            right: 30,
                            left: 50,
                            bottom: 20,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            dataKey="x"
                            name="Costo Unitario"
                            tickFormatter={(value) => `${formatNumber(value)}`}
                            domain={["auto", "auto"]}
                          />
                          <YAxis
                            type="number"
                            dataKey="y"
                            name="Cantidad"
                            tickFormatter={(value) => formatNumber(value)}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            formatter={(
                              value: number,
                              name: string,
                              props: any
                            ) => {
                              if (props.dataKey === "x")
                                return [
                                  `${formatNumber(value)}`,
                                  "Costo Unitario",
                                ];
                              if (props.dataKey === "y")
                                return [formatNumber(value), "Cantidad"];
                              return [formatNumber(value), name];
                            }}
                            labelFormatter={(label: any) => `Tela: ${label.z}`}
                          />
                          <Legend />
                          <Scatter
                            data={visualizationData.fabricCostData.MTS}
                            fill="#8884d8"
                            name="MTS"
                          />
                          <Scatter
                            data={visualizationData.fabricCostData.KGS}
                            fill="#82ca9d"
                            name="KGS"
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <NoDataMessage />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Sección de filtros activos */}
            {isFilterActive && (
              <div className="flex items-center gap-2 text-sm mt-4 pt-3 border-t">
                <span className="text-gray-500">Datos filtrados por:</span>
                <div className="flex flex-wrap gap-2">
                  {filters.unitFilter !== "all" && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      Unidad: {filters.unitFilter}
                    </span>
                  )}
                  {filters.ocFilter !== "all" && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                      OC: {filters.ocFilter}
                    </span>
                  )}
                  {filters.telaFilter !== "all" && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                      Tela: {filters.telaFilter}
                    </span>
                  )}
                  {filters.colorFilter !== "all" && (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                      Color: {filters.colorFilter}
                    </span>
                  )}
                  {filters.searchTerm && (
                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
                      Búsqueda: {filters.searchTerm}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
