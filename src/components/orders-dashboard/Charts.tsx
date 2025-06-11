import React from "react";
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
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChartDataItem {
  name: string;
  value: number;
}

interface BarChartDataItem {
  name: string;
  fullName?: string;
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

interface TooltipPayload {
  value: number;
  payload: BarChartDataItem;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

interface TimelineTooltipPayload {
  value: number;
}

interface TimelineCustomTooltipProps {
  active?: boolean;
  payload?: TimelineTooltipPayload[];
  label?: string;
}

export const PedidosCharts: React.FC<PedidosChartsProps> = ({
  pieChartData,
  barChartData,
  timelineData,
  deliveryData,
  onTabChange,
}) => {
  const handleTabChange = (value: string) => {
    if (onTabChange) onTabChange(value);
  };

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
  ];

  const COLOR_MAP: Record<string, string> = {
    MARINO: "#000080",
    NEGRO: "#000000",
    BLANCO: "#FFFFFF",
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
    "VERDE NEÓN": "#39FF14",
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
    "CAFE / BEIGE": "#D2B48C",
    CAFE: "#6F4E37",
    MIEL: "#FFC30B",
    ARENA: "#C19A6B",
    BRONCE: "#CD7F32",
    CHOCOLATE: "#7B3F00",
    ANTILOPE: "#AB9482",
    "BEIGE. NUEVO": "#F5F5DC",
    BEIIGE: "#F5F5DC",
    "CAFÉ OSCURO": "#3C2415",
    KHAKY: "#C3B091",
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

    "J-0248-3. LEOPARD": "#FFCC5C",
    COW: "#000000",
    OCELOTE: "#FFCC5C",
    TIGER: "#FF8C00",
    "J-0135-2. GIRAFFE": "#DEB887",
    "J-0026-2. ZEBRA": "#000000",
    ZEBRA: "#000000",
    VACA: "#000000",
    HIENA: "#8B7355",
    LEOPARD: "#FFCC5C",
    DALMATA: "#000000",

    C4: "#C4C4C4",
    C2: "#C2C2C2",
    C3: "#C3C3C3",
    "Sin Color": "#D3D3D3",
    "BLANCO #1": "#FFFFFF",
    BLAN: "#FFFFFF",
  };

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

  const TimelineCustomTooltip = ({
    active,
    payload,
    label,
  }: TimelineCustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900 mb-2">
            {formatDateLabel(label || "")}
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

  const OrdersCustomTooltip = ({ active, payload }: CustomTooltipProps) => {
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

  const sortedBarChartData = [...barChartData].sort(
    (a, b) => b.total - a.total
  );

  const sortedColorData = [...pieChartData].sort((a, b) => b.value - a.value);

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

  const calculateOrdersChartHeight = () => {
    const minHeight = 400;
    const heightPerItem = 50;
    return Math.max(minHeight, sortedBarChartData.length * heightPerItem);
  };

  const ordersChartHeight = calculateOrdersChartHeight();

  const NoDataMessage = () => (
    <div className="flex items-center justify-center w-full h-full p-8">
      <p className="text-muted-foreground text-center">
        No hay datos suficientes para mostrar la gráfica.
      </p>
    </div>
  );

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
