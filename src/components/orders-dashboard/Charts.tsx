import React, { useState } from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  Cell,
  TooltipProps,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChartDataItem {
  name: string;
  value: number;
}

interface BarChartDataItem {
  name: string;
  fullName?: string; // Campo opcional para nombre completo
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

interface PedidosChartsProps {
  pieChartData: ChartDataItem[];
  barChartData: BarChartDataItem[];
  timelineData: TimelineDataItem[];
  deliveryData: DeliveryDataItem[];
  onTabChange?: (value: string) => void;
}

export const PedidosCharts: React.FC<PedidosChartsProps> = ({
  pieChartData,
  barChartData,
  timelineData,
  deliveryData,
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState("orders");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (onTabChange) onTabChange(value);
  };

  // Chart colors (para gráficos que no son de colores)
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
  ];

  // Mapeo PRECISO de nombres de colores a colores hexadecimales reales (basado en investigación web)
  const COLOR_MAP: Record<string, string> = {
    // === COLORES PRINCIPALES ===
    MARINO: "#000080", // Navy blue estándar
    NEGRO: "#000000", // Negro puro
    BLANCO: "#FFFFFF", // Blanco puro
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

  // Función mejorada para obtener el color basado en el nombre
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

  // Función mejorada para formatear números con decimales apropiados
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);
    } else if (num >= 1000) {
      return new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);
    } else if (num >= 1) {
      return new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } else {
      return new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(num);
    }
  };

  // Función para calcular porcentajes con decimales apropiados
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

  const formatCurrency = (value: number, decimals = 2): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Función para formatear la fecha en el tooltip (mantener el formato original)
  const formatDateLabel = (dateStr: string): string => {
    const [year, month] = dateStr.split("-");
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const monthName = monthNames[parseInt(month) - 1] || month;
    return `${monthName} ${year}`;
  };

  // Custom tooltip component for Timeline Tab
  const TimelineCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900 mb-2">
            {formatDateLabel(label)}
          </p>
          <p className="text-purple-600 mb-1">
            Cantidad de Pedidos: {payload[0].value}
          </p>
          <p className="text-green-600">
            Total Facturado (USD): ${formatCurrency(payload[1].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Tooltip personalizado para las órdenes
  const OrdersCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900 mb-2">
            {data.fullName || data.name}
          </p>
          <p className="text-blue-600">
            Total Facturado: ${formatCurrency(data.total)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Ordenar los datos para "Órdenes de Compra" por total (de mayor a menor)
  const sortedBarChartData = [...barChartData].sort(
    (a, b) => b.total - a.total
  );

  // Ordenar los datos de colores por valor (de mayor a menor)
  const sortedColorData = [...pieChartData].sort((a, b) => b.value - a.value);

  // Genera ticks personalizados para mostrar solo los años cuando cambian
  const generateCustomTicks = (data: TimelineDataItem[]) => {
    if (!data || data.length === 0) return [];

    const uniqueYears = new Set<string>();
    const customTicks: string[] = [];

    data.forEach((item) => {
      const year = item.date.split("-")[0];
      if (!uniqueYears.has(year)) {
        uniqueYears.add(year);
        customTicks.push(item.date);
      }
    });

    return customTicks;
  };

  // Calcular la altura dinámica para el gráfico de órdenes basado en la cantidad de datos
  const calculateOrdersChartHeight = () => {
    const minHeight = 400;
    const heightPerItem = 50;
    return Math.max(minHeight, sortedBarChartData.length * heightPerItem);
  };

  // Altura dinámica para el gráfico de órdenes
  const ordersChartHeight = calculateOrdersChartHeight();

  // Mensaje cuando no hay datos
  const NoDataMessage = () => (
    <div className="flex items-center justify-center w-full h-full p-8">
      <p className="text-muted-foreground text-center">
        No hay datos suficientes para mostrar la gráfica.
      </p>
    </div>
  );

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
  ];

  return (
    <Tabs
      defaultValue="orders"
      className="w-full"
      onValueChange={handleTabChange}
    >
      <TabsList className="grid grid-cols-4 mb-4">
        <TabsTrigger value="orders">Órdenes de Compra</TabsTrigger>
        <TabsTrigger value="colors">Distribución por Color</TabsTrigger>
        <TabsTrigger value="timeline">Evolución Mensual</TabsTrigger>
        <TabsTrigger value="delivery">Tiempos de Entrega</TabsTrigger>
      </TabsList>

      {/* Tab: Órdenes de Compra */}
      <TabsContent value="orders" className="mt-4">
        <div
          className="w-full bg-white p-4 rounded-lg shadow-sm overflow-y-auto"
          style={{ height: `${ordersChartHeight}px` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={sortedBarChartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              layout="vertical"
              barSize={25}
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
                tickFormatter={(value: number) => `$${formatCurrency(value)}`}
                domain={[0, "dataMax"]}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={200}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<OrdersCustomTooltip />} />
              <Legend />
              <Bar
                dataKey="total"
                fill="#0088FE"
                name="Total Factura (USD)"
                radius={[0, 4, 4, 0]}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Tab: Distribución por Color - VISUALIZACIÓN ESTILO TELAS CON COLORES REALES */}
      <TabsContent value="colors" className="mt-4">
        <div
          className={`w-full bg-white p-4 rounded-lg shadow-sm overflow-y-auto pr-4 ${
            sortedColorData.length > 0
              ? sortedColorData.length <= 5
                ? "h-auto min-h-[300px] max-h-[350px]"
                : "h-[500px]"
              : "h-[300px]"
          }`}
        >
          {sortedColorData.length > 0 ? (
            <div className="w-full">
              {sortedColorData.map((item, index) => {
                const total = sortedColorData.reduce(
                  (sum, d) => sum + d.value,
                  0
                );
                const percentage = calculatePercentage(item.value, total);
                const backgroundColor = getColorForName(item.name, index);
                const textColor = lightColors.includes(item.name.toUpperCase())
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
                          ${formatNumber(item.value)}
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
                                ...sortedColorData.map((d) => d.value)
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
        </div>
      </TabsContent>

      {/* Tab: Evolución Mensual */}
      <TabsContent value="timeline" className="mt-4">
        <div
          className="w-full bg-white p-4 rounded-lg shadow-sm"
          style={{ height: "320px" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timelineData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                ticks={generateCustomTicks(timelineData)}
                tickFormatter={(value) => value.split("-")[0]}
              />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `$${formatCurrency(value)}`}
                width={100}
              />
              <Tooltip content={<TimelineCustomTooltip />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                name="Cantidad de Pedidos"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="total"
                stroke="#82ca9d"
                name="Total Facturado (USD)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Tab: Tiempos de Entrega */}
      <TabsContent value="delivery" className="mt-4">
        <div
          className="w-full bg-white p-4 rounded-lg shadow-sm"
          style={{ height: "320px" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                dataKey="days"
                name="Días"
                unit=" días"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="total"
                name="Total Factura"
                unit=" USD"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `$${formatCurrency(value)}`}
                width={100}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number, name: string) => [
                  name === "total"
                    ? `$${formatCurrency(value)}`
                    : `${value} días`,
                  name === "total" ? "Total Factura" : "Tiempo de Entrega",
                ]}
                labelFormatter={(value: number) => {
                  const item = deliveryData[value];
                  return `Orden: ${item?.orden || ""}`;
                }}
                contentStyle={{ borderRadius: "8px" }}
              />
              <Scatter name="Pedidos" data={deliveryData} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>
    </Tabs>
  );
};
