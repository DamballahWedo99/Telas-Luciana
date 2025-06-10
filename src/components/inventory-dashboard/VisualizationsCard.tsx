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

  // Mapeo PRECISO de nombres de colores a colores hexadecimales reales (igual que en Charts.tsx)
  const COLOR_MAP: Record<string, string> = {
    // === COLORES PRINCIPALES ===
    MARINO: "#000080", // Navy blue estándar
    NEGRO: "#000000", // Negro puro
    BLANCO: "#F5F5F5", // Blanco puro
    REY: "#4169E1", // Royal blue
    ROJO: "#FF0000", // Rojo puro

    // === GRISES ===
    "GRIS OXFORD": "#4A4A4A", // Gris Oxford
    GRIS: "#808080", // Gris estándar
    "GRIS PERLA": "#E6E6FA", // Gris perla
    "GRIS JASPE": "#D2B48C", // Gris jaspe
    "GRIS JASPE OBSCURO": "#8B7D6B", // Gris jaspe oscuro
    "GRIS JASPE CLARO": "#F5F5DC", // Gris jaspe claro
    "GRIS JASPE OSCURO": "#696969", // Gris jaspe oscuro
    "GRIS/NEGRO": "#2F2F2F", // Gris negro
    GRAFITO: "#1C1C1C", // Grafito

    // === MARINOS ESPECÍFICOS ===
    "MARINO MEDIO 3": "#191970", // Midnight blue
    "MARINO MEDIO": "#1E40AF", // Marino medio
    "MARINO OBSCURO": "#000080", // Navy blue oscuro
    "MARINO OBSCURO 2": "#191970", // Midnight blue
    "MARINO CLARO": "#6495ED", // Cornflower blue
    "MARNO CLARO": "#87CEEB", // Sky blue (typo original)
    "MARINO CLARO 1": "#87CEFA", // Light sky blue
    "MARINO 2": "#2F4F4F", // Dark slate gray
    "AZUL MARINO": "#000080", // Navy blue
    "AZUL MARINO MED": "#1E40AF", // Marino medio
    "MARINO OSCURO": "#000080", // Navy blue
    "MARINO. ESPECIAL": "#191970", // Midnight blue

    // === TINTOS Y ROJOS ===
    GUINDA: "#800020", // Burgundy (investigado)
    "VINO. GUNIDA OBSCURO": "#722F37", // Wine
    "GUINDA NFL": "#800020", // Burgundy
    VINO: "#722F37", // Wine
    "ROJO QUEMADO": "#8B0000", // Dark red
    "ROJO (ANTRLOP SHADE)": "#CD5C5C", // Indian red

    // === VERDES ===
    TURQUESA: "#40E0D0", // Turquoise (confirmado)
    BOTELLA: "#006A4E", // Bottle green (investigado)
    VERDE: "#008000", // Verde estándar
    "VERDE NEON": "#39FF14", // Neon green
    "VERDE NEÓN": "#39FF14", // Neon green
    JADE: "#00A86B", // Jade
    "VERDE MILITAR": "#4B5320", // Army green
    "VERDE JADE": "#00A86B", // Jade
    "VERDE AGUA": "#00FFFF", // Aqua
    "VERDE LIMON": "#32CD32", // Lime green
    "VERDE LIMÓN": "#32CD32", // Lime green
    MENTA: "#98FB98", // Pale green
    "VERDE BOSQUE": "#228B22", // Forest green
    "VERDE BANDERA": "#009639", // Flag green
    "JADE. NUEVO": "#00A86B", // Jade
    CELERY: "#9ACD32", // Yellow green

    // === AZULES ===
    BANDERA: "#002868", // Flag blue
    "AZUL INDIGO": "#4B0082", // Indigo
    BLUE: "#0000FF", // Blue
    "AZUL REY": "#4169E1", // Royal blue
    AZUL: "#0000FF", // Blue
    "AZUL CIELO MED": "#87CEEB", // Sky blue medio
    "AZUL FRANCIA MED": "#0055A4", // French blue medio
    "AZUL CELESTE": "#87CEEB", // Sky blue
    "AZUL ACERO": "#4682B4", // Steel blue
    "AZUL CEIL": "#4F94CD", // Steel blue 3
    "AZUL CIELO": "#87CEEB", // Sky blue
    CIELO: "#87CEEB", // Sky blue
    "BLUE RADIANCE": "#0080FF", // Azure
    CARIBE: "#00CED1", // Dark turquoise
    AQUA: "#00FFFF", // Aqua
    AGUA: "#B0E0E6", // Powder blue

    // === AMARILLOS Y NARANJAS ===
    MANGO: "#FFCC5C", // Mango
    "AMARILLO NEON": "#FFFF00", // Yellow neon
    NARANJA: "#FFA500", // Orange
    ORO: "#FFD700", // Gold (confirmado)
    CANARIO: "#FFEF00", // Canary yellow (investigado)
    "AMARILLO BOMBERO": "#FFD300", // Firefighter yellow
    "AMARILLO CANARIO": "#FFEF00", // Canary yellow
    "AMARILLO NEÓN": "#FFFF00", // Neon yellow
    AMARILLO: "#FFFF00", // Yellow
    "AMARILLO MEDIO": "#FFD700", // Medium yellow
    "AMARILLO LIMÓN": "#CCFF00", // Lime yellow
    "NARANJA NEON": "#FF6600", // Neon orange
    NARANAJA: "#FFA500", // Orange (typo)
    "NARANJA TEXAS": "#FF4500", // Orange red
    "NARANJA MECANICA NEÓN": "#FF4500", // Clockwork orange neon
    "NARANAJA NEON": "#FF6600", // Neon orange (typo)
    LIMON: "#CCFF00", // Lime
    "ORO - YEMA": "#FFCC00", // Golden yolk
    DURAZNO: "#FFCBA4", // Peach
    MELON: "#FDBCB4", // Melon

    // === ROSAS Y MORADOS ===
    FIUSHA: "#FF1493", // Deep pink (fuschia)
    "ROSA BABY": "#F4C2C2", // Baby pink
    "ROSA PASTEL": "#FFD1DC", // Pastel pink
    "ROSA NEON": "#FF69B4", // Hot pink
    "ROSA BLITZ": "#FC0FC0", // Bright pink
    "ROSA BUGAMBILIA": "#CC527A", // Bougainvillea pink
    "ROSA MEXICANO": "#E4007C", // Mexican pink
    ROSA: "#FFC0CB", // Pink
    "ROSA MEDIO": "#F08080", // Light coral
    MORADO: "#800080", // Purple
    "MORADO BURDEOS": "#800020", // Burgundy purple
    LILA: "#C8A2C8", // Lilac
    "LILA SUAVE": "#E6E6FA", // Lavender
    LILIA: "#C8A2C8", // Lilac
    "LAVANDA DIGITAL": "#9683EC", // Digital lavender
    "BURNISHED LILAC": "#C8A2C8", // Burnished lilac
    "VERY PERI": "#6667AB", // Very peri (Pantone 2022)
    FRAMBUESA: "#E30B5C", // Raspberry

    // === MARRONES Y BEIGES ===
    OXFORD: "#2F1B14", // Oxford brown
    BEIGE: "#F5F5DC", // Beige
    "PALO DE ROSA": "#E8B4B8", // Rose wood
    COBRE: "#B87333", // Copper
    CAFÉ: "#6F4E37", // Coffee
    HUESO: "#F9F6EE", // Bone
    "CAFÉ / BEIGE": "#D2B48C", // Tan
    "CAFE / BEIGE": "#D2B48C", // Tan
    CAFE: "#6F4E37", // Coffee
    MIEL: "#FFC30B", // Honey
    ARENA: "#C19A6B", // Sand
    BRONCE: "#CD7F32", // Bronze
    CHOCOLATE: "#7B3F00", // Chocolate
    ANTILOPE: "#AB9482", // Antelope
    "BEIGE. NUEVO": "#F5F5DC", // New beige
    BEIIGE: "#F5F5DC", // Beige (typo)
    "CAFÉ OSCURO": "#3C2415", // Dark coffee
    KHAKY: "#C3B091", // Khaki
    KAKI: "#C3B091", // Khaki

    // === COLORES ESPECIALES ===
    MILITAR: "#4B5320", // Army green
    PIZARRA: "#708090", // Slate gray
    SALMON: "#FA8072", // Salmon
    SALMÓN: "#FA8072", // Salmon
    PLÚMBAGO: "#8C92AC", // Plumbago
    PLUMBAGO: "#8C92AC", // Plumbago
    BUGAMBILIA: "#CC527A", // Bougainvillea
    PETRÓLEO: "#003366", // Petroleum
    PETROLEO: "#003366", // Petroleum
    JASPE: "#D73B3E", // Jasper
    CORAL: "#FF7F50", // Coral
    FRESA: "#FF5757", // Strawberry
    SHEDRON: "#E34234", // Cedron
    PERLA: "#F8F6F0", // Pearl
    BLITZ: "#F0F8FF", // Alice blue
    NEUTRO: "#F5F5F5", // Neutral

    // === PATRONES ANIMALES ===
    "J-0248-3. LEOPARD": "#FFCC5C", // Leopard pattern
    COW: "#000000", // Cow pattern (black base)
    OCELOTE: "#FFCC5C", // Ocelot
    TIGER: "#FF8C00", // Tiger orange
    "J-0135-2. GIRAFFE": "#DEB887", // Giraffe pattern
    "J-0026-2. ZEBRA": "#000000", // Zebra pattern
    ZEBRA: "#000000", // Zebra
    VACA: "#000000", // Cow
    HIENA: "#8B7355", // Hyena
    LEOPARD: "#FFCC5C", // Leopard
    DALMATA: "#000000", // Dalmatian

    // === CÓDIGOS ESPECIALES ===
    C4: "#C4C4C4", // Gray code
    C2: "#C2C2C2", // Gray code
    C3: "#C3C3C3", // Gray code
    "Sin Color": "#D3D3D3", // Light gray for no color
    "BLANCO #1": "#FFFFFF", // White #1
    BLAN: "#FFFFFF", // White (truncated)
  };

  // Lista de colores que necesitan texto negro para legibilidad
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

  // Función mejorada para obtener el color basado en el nombre (igual que en Charts.tsx)
  const getColorForName = (
    colorName: string,
    fallbackIndex: number
  ): string => {
    const normalizedName = colorName.toUpperCase().trim();

    // Buscar coincidencia exacta primero
    if (COLOR_MAP[normalizedName]) {
      return COLOR_MAP[normalizedName];
    }

    // Búsqueda fuzzy para variaciones
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      // Buscar si el nombre contiene palabras clave del mapeo
      const keyWords = key.split(" ");
      const nameWords = normalizedName.split(" ");

      // Si hay coincidencia de al menos 2 palabras o una palabra principal
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

    // Si no encuentra coincidencia, usar color por defecto
    return COLORS[fallbackIndex % COLORS.length];
  };

  // Función para calcular porcentajes con decimales apropiados (igual que en Charts.tsx)
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

  // Función para generar PDF específico para la visualización de Colores
  const handleDownloadColorPDF = async () => {
    try {
      const toastId = toast.loading("Generando PDF de Colores...");

      // Crear un contenedor temporal para la visualización de colores
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

      // Ordenar los datos por valor (cantidad)
      const sortedColorData = [...visualizationData.colorQuantityData].sort(
        (a, b) => b.value - a.value
      );

      // Obtener el valor máximo para calcular porcentajes
      const maxValue = Math.max(...sortedColorData.map((item) => item.value));
      const totalValue = sortedColorData.reduce(
        (sum, item) => sum + item.value,
        0
      );

      // Generar las barras para el PDF
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
      const fileName = `colores_cantidad_${date.getFullYear()}${(
        date.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}.pdf`;

      pdf.save(fileName);
      toast.success("PDF de Colores descargado correctamente", { id: toastId });
    } catch (error) {
      console.error("Error al generar el PDF de Colores:", error);
      toast.error("Error al generar el PDF de Colores");
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

    // Si estamos en la pestaña de colores, usar la función especializada
    if (activeTab === "color") {
      handleDownloadColorPDF();
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
