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

  const COLOR_MAP: Record<string, string> = {
    MARINO: "#000080",
    NEGRO: "#000000",
    BLANCO: "#F5F5F5",
    REY: "#4169E1",
    ROJO: "#FF0000",

    "GRIS OXFORD": "#4A4A4A",
    GRIS: "#808080",
    "GRIS PERLA": "#E6E6FA",
    "GRIS JASPE": "#D2B48C",
    "GRIS JASPE OBSCURO": "#8B7D6B",
    "GRIS JASPE CLARO": "#F5F5DC",
    "GRIS JASPE OSCURO": "#696969",
    "GRIS/NEGRO": "#2F2F2F",
    GRAFITO: "#1C1C1C",

    "MARINO MEDIO 3": "#191970",
    "MARINO MEDIO": "#1E40AF",
    "MARINO OBSCURO": "#000080",
    "MARINO OBSCURO 2": "#191970",
    "MARINO CLARO": "#6495ED",
    "MARNO CLARO": "#87CEEB",
    "MARINO CLARO 1": "#87CEFA",
    "MARINO 2": "#2F4F4F",
    "AZUL MARINO": "#000080",
    "AZUL MARINO MED": "#1E40AF",
    "MARINO OSCURO": "#000080",
    "MARINO. ESPECIAL": "#191970",

    GUINDA: "#800020",
    "VINO. GUNIDA OBSCURO": "#722F37",
    "GUINDA NFL": "#800020",
    VINO: "#722F37",
    "ROJO QUEMADO": "#8B0000",
    "ROJO (ANTRLOP SHADE)": "#CD5C5C",

    TURQUESA: "#40E0D0",
    BOTELLA: "#006A4E",
    VERDE: "#008000",
    "VERDE NEON": "#39FF14",
    JADE: "#00A86B",
    "VERDE MILITAR": "#4B5320",
    "VERDE JADE": "#00A86B",
    "VERDE AGUA": "#00FFFF",
    "VERDE LIMON": "#32CD32",
    "VERDE LIMÓN": "#32CD32",
    MENTA: "#98FB98",
    "VERDE BOSQUE": "#228B22",
    "VERDE BANDERA": "#009639",
    "JADE. NUEVO": "#00A86B",
    CELERY: "#9ACD32",

    BANDERA: "#002868",
    "AZUL INDIGO": "#4B0082",
    BLUE: "#0000FF",
    "AZUL REY": "#4169E1",
    AZUL: "#0000FF",
    "AZUL CIELO MED": "#87CEEB",
    "AZUL FRANCIA MED": "#0055A4",
    "AZUL CELESTE": "#87CEEB",
    "AZUL ACERO": "#4682B4",
    "AZUL CEIL": "#4F94CD",
    "AZUL CIELO": "#87CEEB",
    CIELO: "#87CEEB",
    "BLUE RADIANCE": "#0080FF",
    CARIBE: "#00CED1",
    AQUA: "#00FFFF",
    AGUA: "#B0E0E6",

    MANGO: "#FFCC5C",
    "AMARILLO NEON": "#FFFF00",
    NARANJA: "#FFA500",
    ORO: "#FFD700",
    CANARIO: "#FFEF00",
    "AMARILLO BOMBERO": "#FFD300",
    "AMARILLO CANARIO": "#FFEF00",
    "AMARILLO NEÓN": "#FFFF00",
    AMARILLO: "#FFFF00",
    "AMARILLO MEDIO": "#FFD700",
    "AMARILLO LIMÓN": "#CCFF00",
    "NARANJA NEON": "#FF6600",
    NARANAJA: "#FFA500",
    "NARANJA TEXAS": "#FF4500",
    "NARANJA MECANICA NEÓN": "#FF4500",
    "NARANAJA NEON": "#FF6600",
    LIMON: "#CCFF00",
    "ORO - YEMA": "#FFCC00",
    DURAZNO: "#FFCBA4",
    MELON: "#FDBCB4",

    FIUSHA: "#FF1493",
    "ROSA BABY": "#F4C2C2",
    "ROSA PASTEL": "#FFD1DC",
    "ROSA NEON": "#FF69B4",
    "ROSA BLITZ": "#FC0FC0",
    "ROSA BUGAMBILIA": "#CC527A",
    "ROSA MEXICANO": "#E4007C",
    ROSA: "#FFC0CB",
    "ROSA MEDIO": "#F08080",
    MORADO: "#800080",
    "MORADO BURDEOS": "#800020",
    LILA: "#C8A2C8",
    "LILA SUAVE": "#E6E6FA",
    LILIA: "#C8A2C8",
    "LAVANDA DIGITAL": "#9683EC",
    "BURNISHED LILAC": "#C8A2C8",
    "VERY PERI": "#6667AB",
    FRAMBUESA: "#E30B5C",

    OXFORD: "#2F1B14",
    BEIGE: "#F5F5DC",
    "PALO DE ROSA": "#E8B4B8",
    COBRE: "#B87333",
    CAFÉ: "#6F4E37",
    HUESO: "#F9F6EE",
    "CAFÉ / BEIGE": "#D2B48C",
    CAFE: "#6F4E37",
    MIEL: "#FFC30B",
    ARENA: "#C19A6B",
    BRONCE: "#CD7F32",
    CHOCOLATE: "#7B3F00",
    ANTILOPE: "#AB9482",
    "BEIGE. NUEVO": "#F5F5DC",
    BEIIGE: "#F5F5DC",
    "CAFÉ OSCURO": "#3C2415",
    KAKI: "#C3B091",

    MILITAR: "#4B5320",
    PIZARRA: "#708090",
    SALMON: "#FA8072",
    SALMÓN: "#FA8072",
    PLÚMBAGO: "#8C92AC",
    PLUMBAGO: "#8C92AC",
    BUGAMBILIA: "#CC527A",
    PETRÓLEO: "#003366",
    PETROLEO: "#003366",
    JASPE: "#D73B3E",
    CORAL: "#FF7F50",
    FRESA: "#FF5757",
    SHEDRON: "#E34234",
    PERLA: "#F8F6F0",
    BLITZ: "#F0F8FF",
    NEUTRO: "#F5F5F5",
  };

  const lightColors = [
    "BLANCO",
    "BEIGE",
    "HUESO",
    "PERLA",
    "CANARIO",
    "AMARILLO",
    "AMARILLO NEON",
    "AMARILLO CANARIO",
    "AMARILLO NEÓN",
    "LIMON",
    "BLANCO #1",
    "BLAN",
    "ARENA",
    "CREMA",
    "MIEL",
    "ORO",
    "DURAZNO",
    "GRIS PERLA",
    "GRIS JASPE CLARO",
    "LILA SUAVE",
    "ROSA BABY",
    "ROSA PASTEL",
    "MENTA",
    "AGUA",
    "BLITZ",
    "NEUTRO",
    "Sin Color",
    "BEIIGE",
    "BEIGE. NUEVO",
    "VERDE AGUA",
    "AQUA",
    "AMARILLO LIMÓN",
    "VERDE LIMON",
    "VERDE LIMÓN",
    "ORO - YEMA",
    "MELON",
    "C4",
    "C2",
    "C3",
  ];

  const getColorForName = (
    colorName: string,
    fallbackIndex: number
  ): string => {
    const normalizedName = colorName.toUpperCase().trim();

    if (COLOR_MAP[normalizedName]) {
      return COLOR_MAP[normalizedName];
    }

    for (const [key, value] of Object.entries(COLOR_MAP)) {
      const keyWords = key.split(" ");
      const nameWords = normalizedName.split(" ");

      const matches = keyWords.filter((word) =>
        nameWords.some(
          (nameWord) => nameWord.includes(word) || word.includes(nameWord)
        )
      );

      if (
        matches.length >= Math.min(2, keyWords.length) ||
        (keyWords.length === 1 &&
          matches.length === 1 &&
          keyWords[0].length > 4)
      ) {
        return value;
      }
    }

    return COLORS[fallbackIndex % COLORS.length];
  };

  const calculatePercentage = (value: number, total: number): string => {
    const percentage = (value / total) * 100;

    if (percentage >= 1) {
      return `${Math.round(percentage)}%`;
    } else if (percentage >= 0.1) {
      return `${percentage.toFixed(1)}%`;
    } else if (percentage >= 0.01) {
      return `${percentage.toFixed(2)}%`;
    } else {
      return `${percentage.toFixed(3)}%`;
    }
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
      filteredInventory.reduce(
        (acc, item) => {
          const key = item.Tela as string;
          acc[key] = (acc[key] || 0) + item.Total;
          return acc;
        },
        {} as Record<string, number>
      )
    ).map(([name, value]) => ({ name, value }));

    const colorQuantityData = Object.entries(
      filteredInventory.reduce(
        (acc, item) => {
          const key = item.Color as string;
          acc[key] = (acc[key] || 0) + item.Cantidad;
          return acc;
        },
        {} as Record<string, number>
      )
    ).map(([name, value]) => ({ name, value }));

    const ocValueData = Object.entries(
      filteredInventory.reduce(
        (acc, item) => {
          const key = item.OC as string;
          acc[key] = (acc[key] || 0) + item.Total;
          return acc;
        },
        {} as Record<string, number>
      )
    )
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);

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

    const groupedInventory = filteredInventory.reduce(
      (acc, item) => {
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
      },
      {} as Record<
        string,
        { tela: string; color: string; cantidad: number; costo: number }
      >
    );

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
    "#4299E1",
    "#48BB78",
    "#F6AD55",
    "#F56565",
    "#9F7AEA",
    "#38B2AC",
    "#667EEA",
    "#ED64A6",
    "#ECC94B",
    "#81E6D9",
    "#D53F8C",
    "#2B6CB0",
    "#68D391",
    "#FC8181",
    "#B794F4",
  ];

  const isFilterActive =
    filters.searchTerm !== "" ||
    filters.unitFilter !== "all" ||
    filters.ocFilter !== "all" ||
    filters.telaFilter !== "all" ||
    filters.colorFilter !== "all";

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

  const handleDownloadFabricPDF = async () => {
    try {
      const toastId = toast.loading("Generando PDF de Telas...");

      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "800px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.style.padding = "30px";

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

      const barsContainer = document.createElement("div");
      barsContainer.style.marginTop = "20px";

      const sortedData = [...visualizationData.fabricValueData].sort(
        (a, b) => b.value - a.value
      );

      const maxValue = Math.max(...sortedData.map((item) => item.value));
      const totalValue = sortedData.reduce((sum, item) => sum + item.value, 0);

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

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        logging: false,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });

      document.body.removeChild(tempContainer);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 1.0),
        "JPEG",
        10,
        10,
        imgWidth,
        imgHeight
      );

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

      const fileName = `telas_valor_${date.getFullYear()}${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}.pdf`;

      pdf.save(fileName);
      toast.success("PDF de Telas descargado correctamente", { id: toastId });
    } catch {
      toast.error("Error al generar el PDF de Telas");
    }
  };

  const handleDownloadColorPDF = async () => {
    try {
      const toastId = toast.loading("Generando PDF de Colores...");

      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "800px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.style.padding = "30px";

      const titleElement = document.createElement("h1");
      titleElement.style.fontSize = "28px";
      titleElement.style.marginBottom = "10px";
      titleElement.style.fontFamily = "Arial, sans-serif";
      titleElement.textContent = "Cantidad por Color";

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

      const barsContainer = document.createElement("div");
      barsContainer.style.marginTop = "20px";

      const sortedColorData = [...visualizationData.colorQuantityData].sort(
        (a, b) => b.value - a.value
      );

      const maxValue = Math.max(...sortedColorData.map((item) => item.value));
      const totalValue = sortedColorData.reduce(
        (sum, item) => sum + item.value,
        0
      );

      sortedColorData.forEach((item, index) => {
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
        valueLabel.textContent = formatNumber(item.value);

        labelContainer.appendChild(nameLabel);
        labelContainer.appendChild(valueLabel);

        const barContainer = document.createElement("div");
        barContainer.style.width = "100%";
        barContainer.style.height = "25px";
        barContainer.style.backgroundColor = "#f0f0f0";
        barContainer.style.borderRadius = "4px";
        barContainer.style.overflow = "hidden";

        const bar = document.createElement("div");
        const percentage = Math.max((item.value / maxValue) * 100, 8);
        const backgroundColor = getColorForName(item.name, index);
        const textColor = lightColors.includes(item.name.toUpperCase())
          ? "#000000"
          : "#FFFFFF";

        bar.style.width = `${percentage}%`;
        bar.style.height = "100%";
        bar.style.backgroundColor = backgroundColor;
        bar.style.borderRadius = "4px";
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.paddingLeft = "8px";

        const percentText = document.createElement("span");
        percentText.style.color = textColor;
        percentText.style.fontSize = "12px";
        percentText.style.fontWeight = "bold";
        percentText.textContent = calculatePercentage(item.value, totalValue);

        bar.appendChild(percentText);
        barContainer.appendChild(bar);

        itemContainer.appendChild(labelContainer);
        itemContainer.appendChild(barContainer);
        barsContainer.appendChild(itemContainer);
      });

      tempContainer.appendChild(barsContainer);
      document.body.appendChild(tempContainer);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        logging: false,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });

      document.body.removeChild(tempContainer);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 1.0),
        "JPEG",
        10,
        10,
        imgWidth,
        imgHeight
      );

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

      const fileName = `colores_cantidad_${date.getFullYear()}${(
        date.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}.pdf`;

      pdf.save(fileName);
      toast.success("PDF de Colores descargado correctamente", { id: toastId });
    } catch {
      toast.error("Error al generar el PDF de Colores");
    }
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;

    if (activeTab === "fabric") {
      handleDownloadFabricPDF();
      return;
    }

    if (activeTab === "color") {
      handleDownloadColorPDF();
      return;
    }

    try {
      const toastId = toast.loading("Generando PDF...");

      const activeTabContent = chartRef.current.querySelector(
        `[data-state="active"] .h-\\[400px\\]`
      );

      if (!activeTabContent) {
        toast.error("No se pudo encontrar el elemento del gráfico", {
          id: toastId,
        });
        return;
      }

      const clonedElement = activeTabContent.cloneNode(true) as HTMLElement;

      const tooltips = clonedElement.querySelectorAll('[role="tooltip"]');
      tooltips.forEach((tooltip) => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });

      clonedElement.style.height = "500px";
      clonedElement.style.width = "900px";
      clonedElement.style.paddingTop = "20px";
      clonedElement.style.overflow = "visible";

      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "1000px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.style.padding = "30px";

      const titleElement = document.createElement("h1");
      titleElement.style.fontSize = "28px";
      titleElement.style.marginBottom = "10px";
      titleElement.style.fontFamily = "Arial, sans-serif";
      titleElement.textContent = getTabLabel(activeTab);

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

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        logging: false,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });

      document.body.removeChild(tempContainer);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const xPosition = 10;
      const yPosition = Math.max(5, (pageHeight - imgHeight) / 2);

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 1.0),
        "JPEG",
        xPosition,
        yPosition,
        imgWidth,
        imgHeight
      );

      const fileName = `inventario_${activeTab}_${date.getFullYear()}${(
        date.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}.pdf`;

      pdf.save(fileName);

      toast.success("PDF descargado correctamente", { id: toastId });
    } catch {
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

              {/* Cantidad por Color - NUEVA VISUALIZACIÓN ESTILO CHARTS.TSX */}
              <TabsContent value="color">
                <Card>
                  <CardHeader>
                    <CardTitle>Cantidad por Color</CardTitle>
                  </CardHeader>
                  <CardContent
                    className={`overflow-y-auto pr-4 ${
                      visualizationData.colorQuantityData.length > 0
                        ? visualizationData.colorQuantityData.length <= 5
                          ? "h-auto min-h-[300px] max-h-[350px]"
                          : "h-[500px]"
                        : "h-[300px]"
                    }`}
                  >
                    {visualizationData.colorQuantityData.length > 0 ? (
                      <div className="w-full">
                        {visualizationData.colorQuantityData
                          .sort((a, b) => b.value - a.value)
                          .map((item, index) => {
                            const total =
                              visualizationData.colorQuantityData.reduce(
                                (sum, d) => sum + d.value,
                                0
                              );
                            const percentage = calculatePercentage(
                              item.value,
                              total
                            );
                            const backgroundColor = getColorForName(
                              item.name,
                              index
                            );
                            const textColor = lightColors.includes(
                              item.name.toUpperCase()
                            )
                              ? "#000000"
                              : "#FFFFFF";

                            return (
                              <div key={`color-${index}`} className="mb-4">
                                <div className="flex justify-between items-center mb-1">
                                  <span
                                    className="font-medium text-sm max-w-[250px] truncate"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </span>
                                  <div className="text-right">
                                    <div className="text-sm font-semibold">
                                      {formatNumber(item.value)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {percentage}
                                    </div>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                                  <div
                                    className="h-full rounded-full flex items-center pl-2 text-xs font-medium transition-all duration-300"
                                    style={{
                                      width: `${Math.max(
                                        (item.value /
                                          Math.max(
                                            ...visualizationData.colorQuantityData.map(
                                              (d) => d.value
                                            )
                                          )) *
                                          100,
                                        8
                                      )}%`,
                                      backgroundColor,
                                      color: textColor,
                                    }}
                                  >
                                    {percentage}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
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
                          data={visualizationData.ocValueData
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 10)}
                          layout="vertical"
                          margin={{
                            top: 20,
                            right: 30,
                            left: 200,
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
                              props: unknown
                            ) => {
                              const typedProps = props as { dataKey?: string };
                              if (typedProps.dataKey === "x")
                                return [
                                  `${formatNumber(value)}`,
                                  "Costo Unitario",
                                ];
                              if (typedProps.dataKey === "y")
                                return [formatNumber(value), "Cantidad"];
                              return [formatNumber(value), name];
                            }}
                            labelFormatter={(label: unknown) => {
                              const typedLabel = label as { z?: string };
                              return `Tela: ${typedLabel.z || "Sin nombre"}`;
                            }}
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
