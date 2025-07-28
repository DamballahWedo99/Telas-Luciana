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
  Line,
  ScatterChart,
  Scatter,
  Cell,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Area,
  PieChart,
  Pie,
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

interface YearlyOrdersDataItem {
  year: number;
  totalFactura: number;
  orderCount: number;
}

interface TelaVolumeDataItem {
  tipoTela: string;
  totalMetros: number;
  totalValor: number;
  orderCount: number;
}

interface PriceComparisonDataItem {
  tipoTela: string;
  fobUsd: number;
  ddpUsd: number;
  metrosKg: number;
  unidad: string;
}

interface PedidosChartsProps {
  pieChartData: ChartDataItem[];
  barChartData: BarChartDataItem[];
  timelineData: TimelineDataItem[];
  deliveryData: DeliveryDataItem[];
  yearlyOrdersData: YearlyOrdersDataItem[];
  telaVolumeData: TelaVolumeDataItem[];
  priceComparisonData: PriceComparisonDataItem[];
  onTabChange?: (value: string) => void;
}

export const PedidosCharts: React.FC<PedidosChartsProps> = ({
  pieChartData,
  barChartData,
  timelineData,
  deliveryData,
  yearlyOrdersData,
  telaVolumeData,
  priceComparisonData,
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

  const NoDataMessage = () => (
    <div className="flex items-center justify-center w-full h-full p-8">
      <p className="text-muted-foreground text-center">
        No hay datos suficientes para mostrar la gráfica.
      </p>
    </div>
  );

  return (
    <Tabs
      defaultValue="orders"
      className="w-full"
      onValueChange={handleTabChange}
    >
      <TabsList className="grid grid-cols-7 mb-4">
        <TabsTrigger value="orders">Órdenes de Compra</TabsTrigger>
        <TabsTrigger value="colors">Distribución por Color</TabsTrigger>
        <TabsTrigger value="timeline">Evolución Mensual</TabsTrigger>
        <TabsTrigger value="delivery">Tiempos de Entrega</TabsTrigger>
        <TabsTrigger value="yearly">Órdenes por Año</TabsTrigger>
        <TabsTrigger value="tela-volume">Volumen por Tela</TabsTrigger>
        <TabsTrigger value="price-comparison">FOB vs DDP</TabsTrigger>
      </TabsList>

      <TabsContent value="orders" className="mt-4">
        <div className="w-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 rounded-xl shadow-lg">
          {sortedBarChartData.length > 0 ? (
            <div className="space-y-6">
              {/* Header con métricas clave */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Total Órdenes</p>
                      <p className="text-2xl font-bold">
                        {sortedBarChartData.length}
                      </p>
                    </div>
                    <div className="text-3xl">📋</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Valor Total</p>
                      <p className="text-xl font-bold">
                        $
                        {formatCurrency(
                          sortedBarChartData.reduce(
                            (sum, item) => sum + item.total,
                            0
                          )
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">💰</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">
                        Promedio por Orden
                      </p>
                      <p className="text-xl font-bold">
                        $
                        {formatCurrency(
                          sortedBarChartData.reduce(
                            (sum, item) => sum + item.total,
                            0
                          ) / sortedBarChartData.length
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">📊</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Mayor Orden</p>
                      <p className="text-xl font-bold">
                        $
                        {formatCurrency(
                          Math.max(
                            ...sortedBarChartData.map((item) => item.total)
                          )
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">🏆</div>
                  </div>
                </div>
              </div>

              {/* Dashboard principal */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Gráfica principal mejorada */}
                <div className="xl:col-span-3 bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                    🏢 Análisis de Órdenes de Compra por Valor
                  </h3>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.min(
                      600,
                      Math.max(400, sortedBarChartData.length * 35)
                    )}
                  >
                    <ComposedChart
                      data={sortedBarChartData.map((item, index) => ({
                        ...item,
                        rank: index + 1,
                        percentage:
                          (item.total /
                            sortedBarChartData.reduce(
                              (sum, d) => sum + d.total,
                              0
                            )) *
                          100,
                      }))}
                      layout="vertical"
                      margin={{ top: 20, right: 80, left: 20, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient
                          id="orderGradient"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3B82F6"
                            stopOpacity={0.9}
                          />
                          <stop
                            offset="95%"
                            stopColor="#1D4ED8"
                            stopOpacity={0.7}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={true}
                        vertical={false}
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          `$${formatCurrency(value)}`
                        }
                        domain={[0, "dataMax + 10000"]}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        width={180}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value: string) =>
                          value.length > 20
                            ? `${value.substring(0, 17)}...`
                            : value
                        }
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl">
                                <div className="flex items-center space-x-2 mb-3">
                                  <span className="text-2xl">
                                    {data.rank === 1
                                      ? "🥇"
                                      : data.rank === 2
                                        ? "🥈"
                                        : data.rank === 3
                                          ? "🥉"
                                          : "📦"}
                                  </span>
                                  <p className="font-bold text-gray-800">
                                    {data.fullName || data.name}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-blue-600">
                                      Valor: ${formatCurrency(data.total)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-green-600">
                                      Porcentaje: {data.percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-purple-600">
                                      Ranking: #{data.rank}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill="url(#orderGradient)"
                        radius={[0, 8, 8, 0]}
                        name="Valor de Orden (USD)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Panel lateral con insights */}
                <div className="space-y-4">
                  {/* Top 5 órdenes */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                      🏆 Top 5 Órdenes
                    </h4>
                    <div className="space-y-2">
                      {sortedBarChartData.slice(0, 5).map((item, rank) => (
                        <div
                          key={rank}
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">
                              {rank === 0
                                ? "🥇"
                                : rank === 1
                                  ? "🥈"
                                  : rank === 2
                                    ? "🥉"
                                    : "🏅"}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-700 truncate max-w-24">
                                {(item.fullName || item.name).substring(0, 15)}
                                ...
                              </p>
                              <p className="text-xs text-gray-500">
                                #{rank + 1}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600">
                              ${formatCurrency(item.total)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(
                                (item.total /
                                  sortedBarChartData.reduce(
                                    (sum, d) => sum + d.total,
                                    0
                                  )) *
                                100
                              ).toFixed(1)}
                              %
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Distribución por rangos */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      📊 Distribución por Rangos
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const maxValue = Math.max(
                          ...sortedBarChartData.map((item) => item.total)
                        );
                        const ranges = [
                          {
                            min: maxValue * 0.8,
                            max: maxValue,
                            label: "Premium",
                            color: "bg-red-500",
                            count: 0,
                          },
                          {
                            min: maxValue * 0.6,
                            max: maxValue * 0.8,
                            label: "Alto",
                            color: "bg-orange-500",
                            count: 0,
                          },
                          {
                            min: maxValue * 0.4,
                            max: maxValue * 0.6,
                            label: "Medio",
                            color: "bg-yellow-500",
                            count: 0,
                          },
                          {
                            min: 0,
                            max: maxValue * 0.4,
                            label: "Básico",
                            color: "bg-green-500",
                            count: 0,
                          },
                        ];

                        sortedBarChartData.forEach((item) => {
                          ranges.forEach((range) => {
                            if (
                              item.total >= range.min &&
                              item.total <= range.max
                            ) {
                              range.count++;
                            }
                          });
                        });

                        return ranges.map((range, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-3 h-3 ${range.color} rounded-full`}
                              ></div>
                              <span className="text-sm font-medium">
                                {range.label}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-gray-600">
                              {range.count}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Estadísticas rápidas */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      ⚡ Stats Rápidos
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mediana:</span>
                        <span className="font-semibold">
                          $
                          {formatCurrency(
                            sortedBarChartData[
                              Math.floor(sortedBarChartData.length / 2)
                            ]?.total || 0
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Menor Orden:</span>
                        <span className="font-semibold">
                          $
                          {formatCurrency(
                            Math.min(
                              ...sortedBarChartData.map((item) => item.total)
                            )
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Diferencia:</span>
                        <span className="font-semibold">
                          $
                          {formatCurrency(
                            Math.max(
                              ...sortedBarChartData.map((item) => item.total)
                            ) -
                              Math.min(
                                ...sortedBarChartData.map((item) => item.total)
                              )
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <NoDataMessage />
          )}
        </div>
      </TabsContent>

      <TabsContent value="colors" className="mt-4">
        <div className="w-full bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 p-6 rounded-xl shadow-lg">
          {sortedColorData.length > 0 ? (
            <div className="space-y-6">
              {/* Header con métricas de colores */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-pink-600 to-rose-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-pink-100 text-sm">Total Colores</p>
                      <p className="text-2xl font-bold">
                        {sortedColorData.length}
                      </p>
                    </div>
                    <div className="text-3xl">🎨</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-violet-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Color Dominante</p>
                      <p className="text-lg font-bold truncate">
                        {sortedColorData[0]?.name.substring(0, 12) || "N/A"}
                      </p>
                    </div>
                    <div className="text-3xl">👑</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-100 text-sm">Valor Total</p>
                      <p className="text-lg font-bold">
                        $
                        {formatCurrency(
                          sortedColorData.reduce(
                            (sum, item) => sum + item.value,
                            0
                          )
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">💎</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-600 to-teal-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-cyan-100 text-sm">
                        Promedio por Color
                      </p>
                      <p className="text-lg font-bold">
                        $
                        {formatCurrency(
                          sortedColorData.reduce(
                            (sum, item) => sum + item.value,
                            0
                          ) / sortedColorData.length
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">🌈</div>
                  </div>
                </div>
              </div>

              {/* Layout principal */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Gráfica de dona moderna */}
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                    🎭 Distribución Circular
                  </h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={sortedColorData
                          .slice(0, 12)
                          .map((item, index) => ({
                            ...item,
                            fill: getColorForName(item.name, index),
                          }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {sortedColorData.slice(0, 12).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getColorForName(entry.name, index)}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const total = sortedColorData.reduce(
                              (sum, d) => sum + d.value,
                              0
                            );
                            const percentage = (
                              (data.value / total) *
                              100
                            ).toFixed(1);
                            return (
                              <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div
                                    className="w-6 h-6 rounded-full border-2 border-white shadow"
                                    style={{
                                      backgroundColor: getColorForName(
                                        data.name,
                                        0
                                      ),
                                    }}
                                  ></div>
                                  <p className="font-bold text-gray-800">
                                    {data.name}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-green-600">
                                    💰 ${formatCurrency(data.value)}
                                  </p>
                                  <p className="text-blue-600">
                                    📊 {percentage}% del total
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Paleta de colores artística */}
                <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                    🎨 Paleta de Colores por Valor
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {sortedColorData.map((item, index) => {
                      const total = sortedColorData.reduce(
                        (sum, d) => sum + d.value,
                        0
                      );
                      const percentage = calculatePercentage(item.value, total);
                      const backgroundColor = getColorForName(item.name, index);
                      // const textColor = lightColors.includes(item.name.toUpperCase()) ? "#000000" : "#FFFFFF";

                      return (
                        <div
                          key={`color-${index}`}
                          className="group hover:scale-[1.02] transition-all duration-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">
                                  {index === 0
                                    ? "🥇"
                                    : index === 1
                                      ? "🥈"
                                      : index === 2
                                        ? "🥉"
                                        : "🎨"}
                                </span>
                                <div
                                  className="w-8 h-8 rounded-lg border-2 border-white shadow-md"
                                  style={{ backgroundColor }}
                                ></div>
                              </div>
                              <div>
                                <p
                                  className="font-semibold text-gray-800 max-w-48 truncate"
                                  title={item.name}
                                >
                                  {item.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  #{index + 1}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-800">
                                ${formatNumber(item.value)}
                              </p>
                              <p className="text-sm text-gray-500">
                                {percentage}
                              </p>
                            </div>
                          </div>

                          {/* Barra de progreso artística */}
                          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                            <div
                              className="h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                              style={{
                                width: `${Math.max(
                                  (item.value /
                                    Math.max(
                                      ...sortedColorData.map((d) => d.value)
                                    )) *
                                    100,
                                  5
                                )}%`,
                                background: `linear-gradient(90deg, ${backgroundColor}dd, ${backgroundColor})`,
                                boxShadow: `inset 0 1px 2px rgba(0,0,0,0.1)`,
                              }}
                            ></div>
                          </div>

                          {/* Etiqueta flotante en hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1">
                            <div className="text-xs text-gray-600 flex justify-between">
                              <span>Participación: {percentage}</span>
                              <span>Ranking: #{index + 1}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Panel de insights de colores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Top 5 colores */}
                <div className="bg-white rounded-xl p-4 shadow-md">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                    🏆 Top 5 Colores
                  </h4>
                  <div className="space-y-3">
                    {sortedColorData.slice(0, 5).map((item, rank) => (
                      <div
                        key={rank}
                        className="flex items-center space-x-3 p-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100"
                      >
                        <span className="text-lg">
                          {rank === 0
                            ? "🥇"
                            : rank === 1
                              ? "🥈"
                              : rank === 2
                                ? "🥉"
                                : "🏅"}
                        </span>
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white shadow"
                          style={{
                            backgroundColor: getColorForName(item.name, rank),
                          }}
                        ></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700 truncate max-w-24">
                            {item.name.substring(0, 15)}...
                          </p>
                          <p className="text-xs text-gray-500">
                            ${formatCurrency(item.value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Categorías por intensidad */}
                <div className="bg-white rounded-xl p-4 shadow-md">
                  <h4 className="font-bold text-gray-800 mb-3">
                    🌈 Por Intensidad
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const colorCategories = {
                        oscuros: ["NEGRO", "MARINO", "GRAFITO", "CAFÉ"],
                        claros: ["BLANCO", "BEIGE", "HUESO", "PERLA"],
                        vibrantes: ["ROJO", "AZUL", "VERDE", "AMARILLO"],
                        neutros: ["GRIS", "ARENA", "KAKI", "NEUTRO"],
                      };

                      return Object.entries(colorCategories).map(
                        ([category, colors]) => {
                          const categoryValue = sortedColorData
                            .filter((item) =>
                              colors.some((color) =>
                                item.name.toUpperCase().includes(color)
                              )
                            )
                            .reduce((sum, item) => sum + item.value, 0);

                          const categoryColors = [
                            "bg-gray-800",
                            "bg-gray-200",
                            "bg-rainbow",
                            "bg-gray-400",
                          ];

                          return (
                            <div
                              key={category}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-3 h-3 ${categoryColors[Object.keys(colorCategories).indexOf(category)]} rounded-full`}
                                ></div>
                                <span className="text-sm font-medium capitalize">
                                  {category}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-gray-600">
                                ${formatCurrency(categoryValue)}
                              </span>
                            </div>
                          );
                        }
                      );
                    })()}
                  </div>
                </div>

                {/* Estadísticas de diversidad */}
                <div className="bg-white rounded-xl p-4 shadow-md">
                  <h4 className="font-bold text-gray-800 mb-3">
                    📈 Diversidad de Colores
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Índice de Diversidad:
                      </span>
                      <span className="font-semibold">
                        {(
                          100 -
                          (sortedColorData[0]?.value /
                            sortedColorData.reduce(
                              (sum, item) => sum + item.value,
                              0
                            )) *
                            100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Colores Únicos:</span>
                      <span className="font-semibold">
                        {sortedColorData.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Color Menos Usado:</span>
                      <span className="font-semibold">
                        $
                        {formatCurrency(
                          Math.min(...sortedColorData.map((item) => item.value))
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Diferencia Max-Min:</span>
                      <span className="font-semibold">
                        $
                        {formatCurrency(
                          sortedColorData[0]?.value -
                            sortedColorData[sortedColorData.length - 1]?.value
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <NoDataMessage />
          )}
        </div>
      </TabsContent>

      <TabsContent value="timeline" className="mt-4">
        <div className="w-full bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6 rounded-xl shadow-lg">
          {timelineData.length > 0 ? (
            <div className="space-y-6">
              {/* Header con métricas temporales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-amber-600 to-yellow-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-100 text-sm">Período Total</p>
                      <p className="text-2xl font-bold">
                        {timelineData.length} meses
                      </p>
                    </div>
                    <div className="text-3xl">📅</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Pico de Pedidos</p>
                      <p className="text-2xl font-bold">
                        {Math.max(...timelineData.map((item) => item.count))}
                      </p>
                    </div>
                    <div className="text-3xl">📈</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-600 to-pink-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm">Mayor Facturación</p>
                      <p className="text-lg font-bold">
                        $
                        {formatCurrency(
                          Math.max(...timelineData.map((item) => item.total))
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">💎</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-pink-600 to-purple-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-pink-100 text-sm">Crecimiento</p>
                      <p className="text-xl font-bold">
                        {timelineData.length > 1
                          ? (
                              ((timelineData[timelineData.length - 1].total -
                                timelineData[0].total) /
                                timelineData[0].total) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                    </div>
                    <div className="text-3xl">🚀</div>
                  </div>
                </div>
              </div>

              {/* Dashboard principal temporal */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Gráfica temporal principal */}
                <div className="xl:col-span-3 bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                    📊 Evolución Temporal de Pedidos y Facturación
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart
                      data={timelineData.map((item, index) => ({
                        ...item,
                        trend:
                          index > 0
                            ? (
                                ((item.total - timelineData[index - 1].total) /
                                  timelineData[index - 1].total) *
                                100
                              ).toFixed(1)
                            : 0,
                        efficiency:
                          item.count > 0 ? item.total / item.count : 0,
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <defs>
                        <linearGradient
                          id="countGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#F59E0B"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#F59E0B"
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                        <linearGradient
                          id="totalGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10B981"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10B981"
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        ticks={generateCustomTicks(timelineData)}
                        tickFormatter={(value) => {
                          const [year, month] = value.split("-");
                          const monthNames = [
                            "Ene",
                            "Feb",
                            "Mar",
                            "Abr",
                            "May",
                            "Jun",
                            "Jul",
                            "Ago",
                            "Sep",
                            "Oct",
                            "Nov",
                            "Dic",
                          ];
                          return `${monthNames[parseInt(month) - 1]} ${year}`;
                        }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: "Cantidad de Pedidos",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          `$${formatCurrency(value)}`
                        }
                        width={100}
                        label={{
                          value: "Facturación USD",
                          angle: 90,
                          position: "insideRight",
                        }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl">
                                <p className="font-bold text-gray-800 mb-3">
                                  {formatDateLabel(label || "")}
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                    <span className="text-orange-600">
                                      📦 Pedidos: {data.count}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-green-600">
                                      💰 Facturación: $
                                      {formatCurrency(data.total)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-blue-600">
                                      ⚡ Eficiencia: $
                                      {formatCurrency(data.efficiency)}/pedido
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-purple-600">
                                      📈 Variación: {data.trend}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="count"
                        fill="url(#countGradient)"
                        stroke="#F59E0B"
                        strokeWidth={3}
                        name="Cantidad de Pedidos"
                        dot={{ fill: "#F59E0B", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: "#F59E0B" }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="total"
                        stroke="#10B981"
                        strokeWidth={4}
                        name="Total Facturado (USD)"
                        dot={{ fill: "#10B981", strokeWidth: 2, r: 5 }}
                        activeDot={{ r: 7, fill: "#10B981" }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="efficiency"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Eficiencia (USD/pedido)"
                        dot={{ fill: "#8B5CF6", strokeWidth: 1, r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Panel lateral con análisis temporal */}
                <div className="space-y-4">
                  {/* Mejores meses */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      🏆 Mejores Meses
                    </h4>
                    <div className="space-y-2">
                      {timelineData
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 5)
                        .map((item, rank) => (
                          <div
                            key={rank}
                            className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {rank === 0
                                  ? "🥇"
                                  : rank === 1
                                    ? "🥈"
                                    : rank === 2
                                      ? "🥉"
                                      : "🏅"}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-700">
                                  {formatDateLabel(item.date)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {item.count} pedidos
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">
                                ${formatCurrency(item.total)}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Análisis de tendencias */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      📈 Tendencias
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const avgMonthlyGrowth =
                          timelineData.length > 1
                            ? timelineData
                                .slice(1)
                                .reduce((sum, item, index) => {
                                  const prev = timelineData[index];
                                  return (
                                    sum +
                                    ((item.total - prev.total) / prev.total) *
                                      100
                                  );
                                }, 0) /
                              (timelineData.length - 1)
                            : 0;

                        const seasonality = {
                          q1: timelineData.filter((item) =>
                            [1, 2, 3].includes(
                              parseInt(item.date.split("-")[1])
                            )
                          ),
                          q2: timelineData.filter((item) =>
                            [4, 5, 6].includes(
                              parseInt(item.date.split("-")[1])
                            )
                          ),
                          q3: timelineData.filter((item) =>
                            [7, 8, 9].includes(
                              parseInt(item.date.split("-")[1])
                            )
                          ),
                          q4: timelineData.filter((item) =>
                            [10, 11, 12].includes(
                              parseInt(item.date.split("-")[1])
                            )
                          ),
                        };

                        const bestQuarter = Object.entries(seasonality)
                          .map(([quarter, data]) => ({
                            quarter,
                            avg:
                              data.reduce((sum, item) => sum + item.total, 0) /
                                data.length || 0,
                          }))
                          .sort((a, b) => b.avg - a.avg)[0];

                        return (
                          <>
                            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                              <span className="text-sm text-gray-600">
                                Crecimiento Promedio:
                              </span>
                              <span
                                className={`text-sm font-bold ${avgMonthlyGrowth >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {avgMonthlyGrowth.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                              <span className="text-sm text-gray-600">
                                Mejor Trimestre:
                              </span>
                              <span className="text-sm font-bold text-yellow-600">
                                {bestQuarter?.quarter.toUpperCase() || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                              <span className="text-sm text-gray-600">
                                Volatilidad:
                              </span>
                              <span className="text-sm font-bold text-purple-600">
                                {timelineData.length > 1
                                  ? Math.sqrt(
                                      timelineData.reduce(
                                        (sum, item, index) => {
                                          if (index === 0) return sum;
                                          const prev = timelineData[index - 1];
                                          const change =
                                            ((item.total - prev.total) /
                                              prev.total) *
                                            100;
                                          return (
                                            sum +
                                            Math.pow(
                                              change - avgMonthlyGrowth,
                                              2
                                            )
                                          );
                                        },
                                        0
                                      ) /
                                        (timelineData.length - 1)
                                    ).toFixed(1) + "%"
                                  : "N/A"}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Stats rápidos temporales */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      ⚡ Stats Temporales
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Promedio Mensual:</span>
                        <span className="font-semibold">
                          $
                          {formatCurrency(
                            timelineData.reduce(
                              (sum, item) => sum + item.total,
                              0
                            ) / timelineData.length
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mes Más Bajo:</span>
                        <span className="font-semibold">
                          $
                          {formatCurrency(
                            Math.min(...timelineData.map((item) => item.total))
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pedidos/Mes Prom:</span>
                        <span className="font-semibold">
                          {(
                            timelineData.reduce(
                              (sum, item) => sum + item.count,
                              0
                            ) / timelineData.length
                          ).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rango de Fechas:</span>
                        <span className="font-semibold text-xs">
                          {timelineData.length > 0
                            ? `${formatDateLabel(timelineData[0].date)} - ${formatDateLabel(timelineData[timelineData.length - 1].date)}`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <NoDataMessage />
          )}
        </div>
      </TabsContent>

      <TabsContent value="delivery" className="mt-4">
        <div className="w-full bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 p-6 rounded-xl shadow-lg">
          {(() => {
            console.log(`🔍 Datos de entrega en Charts.tsx:`, deliveryData.length, deliveryData);
            console.log(`📊 Primeros 5 elementos:`, deliveryData.slice(0, 5));
            return null;
          })()}
          {deliveryData.length > 0 ? (
            <div className="space-y-6">
              {/* Header con métricas logísticas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-teal-600 to-cyan-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-100 text-sm">Tiempo Promedio</p>
                      <p className="text-2xl font-bold">
                        {(
                          deliveryData.reduce(
                            (sum, item) => sum + item.days,
                            0
                          ) / deliveryData.length
                        ).toFixed(0)}{" "}
                        días
                      </p>
                    </div>
                    <div className="text-3xl">📦</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-cyan-100 text-sm">
                        Entrega Más Rápida
                      </p>
                      <p className="text-2xl font-bold">
                        {Math.min(...deliveryData.map((item) => item.days))}{" "}
                        días
                      </p>
                    </div>
                    <div className="text-3xl">⚡</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Entrega Más Lenta</p>
                      <p className="text-2xl font-bold">
                        {Math.max(...deliveryData.map((item) => item.days))}{" "}
                        días
                      </p>
                    </div>
                    <div className="text-3xl">🐌</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-100 text-sm">
                        Eficiencia Global
                      </p>
                      <p className="text-xl font-bold">
                        {(
                          (deliveryData.filter((item) => item.days <= 45)
                            .length /
                            deliveryData.length) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                    <div className="text-3xl">🎯</div>
                  </div>
                </div>
              </div>

              {/* Dashboard logístico principal */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Gráfica de dispersión mejorada */}
                <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                    🚚 Análisis de Rendimiento Logístico
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart
                      data={(() => {
                        const scatterData = deliveryData.map((item) => ({
                          ...item,
                          efficiency: item.total / item.days, // USD por día
                          performance:
                            item.days <= 30
                              ? "excelente"
                              : item.days <= 45
                                ? "bueno"
                                : item.days <= 60
                                  ? "regular"
                                  : "lento",
                          size: Math.sqrt(item.total / 1000) + 8,
                        }));
                        console.log(`📈 Datos preparados para ScatterChart:`, scatterData.length, scatterData);
                        return scatterData;
                      })()}
                      margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        type="number"
                        dataKey="days"
                        name="Días de Entrega"
                        unit=" días"
                        axisLine={false}
                        tickLine={false}
                        domain={[0, "dataMax + 10"]}
                      />
                      <YAxis
                        type="number"
                        dataKey="total"
                        name="Valor de Orden"
                        unit=" USD"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          `$${formatCurrency(value)}`
                        }
                        width={100}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl">
                                <div className="flex items-center space-x-2 mb-3">
                                  <span className="text-2xl">
                                    {data.performance === "excelente"
                                      ? "🚀"
                                      : data.performance === "bueno"
                                        ? "✅"
                                        : data.performance === "regular"
                                          ? "⚠️"
                                          : "🐌"}
                                  </span>
                                  <p className="font-bold text-gray-800">
                                    {data.orden}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-blue-600">
                                      ⏱️ {data.days} días
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-green-600">
                                      💰 ${formatCurrency(data.total)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-purple-600">
                                      ⚡ ${formatCurrency(data.efficiency)}/día
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className={`w-3 h-3 ${
                                        data.performance === "excelente"
                                          ? "bg-green-500"
                                          : data.performance === "bueno"
                                            ? "bg-yellow-500"
                                            : data.performance === "regular"
                                              ? "bg-orange-500"
                                              : "bg-red-500"
                                      } rounded-full`}
                                    ></div>
                                    <span
                                      className={`${
                                        data.performance === "excelente"
                                          ? "text-green-600"
                                          : data.performance === "bueno"
                                            ? "text-yellow-600"
                                            : data.performance === "regular"
                                              ? "text-orange-600"
                                              : "text-red-600"
                                      } capitalize`}
                                    >
                                      🎯 {data.performance}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter dataKey="size" fill="#8B5CF6">
                        {deliveryData.map((entry, index) => {
                          const performance =
                            entry.days <= 30
                              ? "excelente"
                              : entry.days <= 45
                                ? "bueno"
                                : entry.days <= 60
                                  ? "regular"
                                  : "lento";
                          const color =
                            performance === "excelente"
                              ? "#10B981"
                              : performance === "bueno"
                                ? "#F59E0B"
                                : performance === "regular"
                                  ? "#F97316"
                                  : "#EF4444";
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>

                  {/* Leyenda de rendimiento */}
                  <div className="flex justify-center mt-4 space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Excelente (≤30 días)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Bueno (31-45 días)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>Regular (46-60 días)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Lento (&gt;60 días)</span>
                    </div>
                  </div>
                </div>

                {/* Panel de control logístico */}
                <div className="space-y-4">
                  {/* Ranking de entregas más rápidas */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                      🏎️ Entregas Más Rápidas
                    </h4>
                    <div className="space-y-2">
                      {deliveryData
                        .sort((a, b) => a.days - b.days)
                        .slice(0, 5)
                        .map((item, rank) => (
                          <div
                            key={rank}
                            className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {rank === 0
                                  ? "🚀"
                                  : rank === 1
                                    ? "⚡"
                                    : rank === 2
                                      ? "💨"
                                      : "✅"}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-700 truncate max-w-20">
                                  {item.orden.substring(0, 12)}...
                                </p>
                                <p className="text-xs text-gray-500">
                                  ${formatCurrency(item.total)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">
                                {item.days} días
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Distribución por categorías de tiempo */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      📊 Distribución por Tiempo
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const categories = [
                          {
                            label: "Express (≤20 días)",
                            min: 0,
                            max: 20,
                            color: "bg-green-500",
                            icon: "🚀",
                          },
                          {
                            label: "Rápido (21-30 días)",
                            min: 21,
                            max: 30,
                            color: "bg-blue-500",
                            icon: "⚡",
                          },
                          {
                            label: "Normal (31-45 días)",
                            min: 31,
                            max: 45,
                            color: "bg-yellow-500",
                            icon: "📦",
                          },
                          {
                            label: "Lento (46-60 días)",
                            min: 46,
                            max: 60,
                            color: "bg-orange-500",
                            icon: "⏳",
                          },
                          {
                            label: "Muy Lento (60 días)",
                            min: 61,
                            max: 999,
                            color: "bg-red-500",
                            icon: "🐌",
                          },
                        ];

                        return categories.map((category, index) => {
                          const count = deliveryData.filter(
                            (item) =>
                              item.days >= category.min &&
                              item.days <= category.max
                          ).length;
                          const percentage = (
                            (count / deliveryData.length) *
                            100
                          ).toFixed(1);

                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{category.icon}</span>
                                <div
                                  className={`w-3 h-3 ${category.color} rounded-full`}
                                ></div>
                                <span className="text-sm font-medium text-gray-700">
                                  {category.label}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-gray-600">
                                  {count}
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  ({percentage}%)
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* KPIs logísticos */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      🎯 KPIs Logísticos
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Entregas a Tiempo (≤45d):
                        </span>
                        <span className="font-semibold text-green-600">
                          {(
                            (deliveryData.filter((item) => item.days <= 45)
                              .length /
                              deliveryData.length) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Eficiencia Promedio:
                        </span>
                        <span className="font-semibold">
                          $
                          {formatCurrency(
                            deliveryData.reduce(
                              (sum, item) => sum + item.total / item.days,
                              0
                            ) / deliveryData.length
                          )}
                          /día
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Variabilidad (σ):</span>
                        <span className="font-semibold text-orange-600">
                          {(() => {
                            const avg =
                              deliveryData.reduce(
                                (sum, item) => sum + item.days,
                                0
                              ) / deliveryData.length;
                            const variance =
                              deliveryData.reduce(
                                (sum, item) =>
                                  sum + Math.pow(item.days - avg, 2),
                                0
                              ) / deliveryData.length;
                            return Math.sqrt(variance).toFixed(1);
                          })()}{" "}
                          días
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mediana:</span>
                        <span className="font-semibold">
                          {(() => {
                            const sorted = [...deliveryData].sort(
                              (a, b) => a.days - b.days
                            );
                            const mid = Math.floor(sorted.length / 2);
                            return sorted.length % 2 === 0
                              ? (
                                  (sorted[mid - 1].days + sorted[mid].days) /
                                  2
                                ).toFixed(0)
                              : sorted[mid].days;
                          })()}{" "}
                          días
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Percentil 95:</span>
                        <span className="font-semibold text-red-600">
                          {(() => {
                            const sorted = [...deliveryData].sort(
                              (a, b) => a.days - b.days
                            );
                            const index = Math.ceil(sorted.length * 0.95) - 1;
                            return sorted[index]?.days || 0;
                          })()}{" "}
                          días
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfica de histograma de distribución */}
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                  📈 Distribución de Tiempos de Entrega
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart
                    data={(() => {
                      const buckets = Array.from({ length: 8 }, (_, i) => ({
                        range: `${i * 15 + 1}-${(i + 1) * 15}`,
                        count: 0,
                        min: i * 15 + 1,
                        max: (i + 1) * 15,
                      }));

                      deliveryData.forEach((item) => {
                        const bucketIndex = Math.min(
                          Math.floor((item.days - 1) / 15),
                          7
                        );
                        if (bucketIndex >= 0 && bucketIndex < buckets.length) {
                          buckets[bucketIndex].count++;
                        }
                      });

                      return buckets.filter((bucket) => bucket.count > 0);
                    })()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="range"
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "Días de Entrega",
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "Cantidad de Órdenes",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      formatter={(value: number) => [value, "Órdenes"]}
                      labelFormatter={(label) => `Rango: ${label} días`}
                    />
                    <Bar
                      dataKey="count"
                      fill="#0EA5E9"
                      radius={[4, 4, 0, 0]}
                      name="Cantidad de Órdenes"
                    >
                      {(() => {
                        const buckets = Array.from({ length: 8 }, (_, i) => ({
                          range: `${i * 15 + 1}-${(i + 1) * 15}`,
                          count: 0,
                          min: i * 15 + 1,
                          max: (i + 1) * 15,
                        }));

                        deliveryData.forEach((item) => {
                          const bucketIndex = Math.min(
                            Math.floor((item.days - 1) / 15),
                            7
                          );
                          if (
                            bucketIndex >= 0 &&
                            bucketIndex < buckets.length
                          ) {
                            buckets[bucketIndex].count++;
                          }
                        });

                        return buckets
                          .filter((bucket) => bucket.count > 0)
                          .map((bucket, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                bucket.max <= 30
                                  ? "#10B981"
                                  : bucket.max <= 45
                                    ? "#F59E0B"
                                    : bucket.max <= 60
                                      ? "#F97316"
                                      : "#EF4444"
                              }
                            />
                          ));
                      })()}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <NoDataMessage />
          )}
        </div>
      </TabsContent>

      <TabsContent value="yearly" className="mt-4">
        <div className="w-full bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 p-6 rounded-xl shadow-lg">
          {yearlyOrdersData.length > 0 ? (
            <div className="space-y-6">
              {/* Header con métricas anuales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-100 text-sm">Años Activos</p>
                      <p className="text-2xl font-bold">
                        {yearlyOrdersData.length}
                      </p>
                    </div>
                    <div className="text-3xl">📅</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Mejor Año</p>
                      <p className="text-2xl font-bold">
                        {(() => {
                          const bestYear = yearlyOrdersData.reduce((prev, current) => 
                            prev.totalFactura > current.totalFactura ? prev : current
                          );
                          return bestYear.year;
                        })()}
                      </p>
                    </div>
                    <div className="text-3xl">🏆</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-600 to-teal-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-cyan-100 text-sm">Total Acumulado</p>
                      <p className="text-lg font-bold">
                        $
                        {formatCurrency(
                          yearlyOrdersData.reduce(
                            (sum, item) => sum + item.totalFactura,
                            0
                          )
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">💎</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-teal-600 to-green-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-100 text-sm">
                        Crecimiento Promedio
                      </p>
                      <p className="text-xl font-bold">
                        {yearlyOrdersData.length > 1
                          ? (() => {
                              const sortedData = [...yearlyOrdersData].sort((a, b) => a.year - b.year);
                              const growthRates = [];
                              for (let i = 1; i < sortedData.length; i++) {
                                const growth = ((sortedData[i].totalFactura - sortedData[i - 1].totalFactura) / sortedData[i - 1].totalFactura) * 100;
                                growthRates.push(growth);
                              }
                              const avgGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
                              return `${avgGrowth.toFixed(1)}%`;
                            })()
                          : "N/A"}
                      </p>
                    </div>
                    <div className="text-3xl">📈</div>
                  </div>
                </div>
              </div>

              {/* Dashboard principal anual */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Gráfica principal mejorada */}
                <div className="xl:col-span-3 bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                    📊 Evolución Anual: Facturación y Volumen de Órdenes
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart
                      data={yearlyOrdersData.map((item) => {
                        const sortedData = [...yearlyOrdersData].sort((a, b) => a.year - b.year);
                        const currentIndex = sortedData.findIndex(d => d.year === item.year);
                        const prevYear = currentIndex > 0 ? sortedData[currentIndex - 1] : null;
                        
                        return {
                          ...item,
                          growth: prevYear 
                            ? ((item.totalFactura - prevYear.totalFactura) / prevYear.totalFactura) * 100
                            : 0,
                          efficiency: item.orderCount > 0 ? item.totalFactura / item.orderCount : 0,
                          performance: item.totalFactura > (yearlyOrdersData.reduce((sum, d) => sum + d.totalFactura, 0) / yearlyOrdersData.length) ? "above" : "below"
                        };
                      }).sort((a, b) => a.year - b.year)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient
                          id="revenueGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3B82F6"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3B82F6"
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                        <linearGradient
                          id="orderCountGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10B981"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10B981"
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="year"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="revenue"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          `$${formatCurrency(value)}`
                        }
                        label={{
                          value: "Facturación (USD)",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <YAxis
                        yAxisId="orders"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        label={{
                          value: "Cantidad de Órdenes",
                          angle: 90,
                          position: "insideRight",
                        }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl">
                                <div className="flex items-center space-x-2 mb-3">
                                  <span className="text-2xl">
                                    {data.performance === "above" ? "🚀" : "📊"}
                                  </span>
                                  <p className="font-bold text-gray-800">
                                    Año {label}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-blue-600">
                                      💰 Facturación: ${formatCurrency(data.totalFactura)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-green-600">
                                      📦 Órdenes: {data.orderCount}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-purple-600">
                                      ⚡ Promedio/Orden: ${formatCurrency(data.efficiency)}
                                    </span>
                                  </div>
                                  {Math.abs(data.growth) > 0.1 && (
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-3 h-3 ${data.growth > 0 ? "bg-emerald-500" : "bg-red-500"} rounded-full`}></div>
                                      <span className={`${data.growth > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                        📈 Crecimiento: {data.growth > 0 ? "+" : ""}{data.growth.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Area
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="totalFactura"
                        fill="url(#revenueGradient)"
                        stroke="#3B82F6"
                        strokeWidth={3}
                        name="Total Facturado (USD)"
                        dot={{ fill: "#3B82F6", strokeWidth: 2, r: 5 }}
                        activeDot={{ r: 7, fill: "#3B82F6" }}
                      />
                      <Bar
                        yAxisId="orders"
                        dataKey="orderCount"
                        fill="#10B981"
                        name="Cantidad de Órdenes"
                        radius={[4, 4, 0, 0]}
                        opacity={0.8}
                      />
                      <Line
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="efficiency"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Eficiencia (USD/orden)"
                        dot={{ fill: "#8B5CF6", strokeWidth: 1, r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Panel lateral con análisis anual */}
                <div className="space-y-4">
                  {/* Ranking de años */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      🏆 Ranking de Años
                    </h4>
                    <div className="space-y-2">
                      {yearlyOrdersData
                        .sort((a, b) => b.totalFactura - a.totalFactura)
                        .slice(0, 5)
                        .map((item, rank) => (
                          <div
                            key={rank}
                            className="flex items-center justify-between p-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {rank === 0
                                  ? "🥇"
                                  : rank === 1
                                    ? "🥈"
                                    : rank === 2
                                      ? "🥉"
                                      : "🏅"}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-700">
                                  {item.year}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {item.orderCount} órdenes
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-blue-600">
                                ${formatCurrency(item.totalFactura)}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Tendencias y proyecciones */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      📈 Análisis de Tendencias
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const bestYear = yearlyOrdersData.reduce((prev, current) => 
                          prev.totalFactura > current.totalFactura ? prev : current
                        );
                        const worstYear = yearlyOrdersData.reduce((prev, current) => 
                          prev.totalFactura < current.totalFactura ? prev : current
                        );
                        
                        const avgRevenue = yearlyOrdersData.reduce((sum, item) => sum + item.totalFactura, 0) / yearlyOrdersData.length;
                        const avgOrders = yearlyOrdersData.reduce((sum, item) => sum + item.orderCount, 0) / yearlyOrdersData.length;

                        return (
                          <>
                            <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                              <span className="text-sm text-gray-600">
                                📊 Año Pico:
                              </span>
                              <span className="text-sm font-bold text-green-600">
                                {bestYear.year} (${formatCurrency(bestYear.totalFactura)})
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                              <span className="text-sm text-gray-600">
                                📉 Año Más Bajo:
                              </span>
                              <span className="text-sm font-bold text-red-600">
                                {worstYear.year} (${formatCurrency(worstYear.totalFactura)})
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                              <span className="text-sm text-gray-600">
                                📈 Promedio Anual:
                              </span>
                              <span className="text-sm font-bold text-blue-600">
                                ${formatCurrency(avgRevenue)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                              <span className="text-sm text-gray-600">
                                🎯 Órdenes/Año Prom:
                              </span>
                              <span className="text-sm font-bold text-purple-600">
                                {avgOrders.toFixed(0)}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* KPIs anuales */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      🎯 KPIs Anuales
                    </h4>
                    <div className="space-y-2 text-sm">
                      {(() => {
                        const sortedData = [...yearlyOrdersData].sort((a, b) => a.year - b.year);
                        const totalRevenue = yearlyOrdersData.reduce((sum, item) => sum + item.totalFactura, 0);
                        const totalOrders = yearlyOrdersData.reduce((sum, item) => sum + item.orderCount, 0);
                        
                        // Calcular volatilidad
                        const avgRevenue = totalRevenue / yearlyOrdersData.length;
                        const variance = yearlyOrdersData.reduce((sum, item) => 
                          sum + Math.pow(item.totalFactura - avgRevenue, 2), 0
                        ) / yearlyOrdersData.length;
                        const volatility = Math.sqrt(variance);

                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Histórico:</span>
                              <span className="font-semibold">
                                ${formatCurrency(totalRevenue)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Órdenes:</span>
                              <span className="font-semibold">{totalOrders}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Volatilidad:</span>
                              <span className="font-semibold text-orange-600">
                                ${formatCurrency(volatility)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Rango de Años:</span>
                              <span className="font-semibold text-gray-600">
                                {sortedData.length > 0 
                                  ? `${sortedData[0].year} - ${sortedData[sortedData.length - 1].year}`
                                  : "N/A"}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <NoDataMessage />
          )}
        </div>
      </TabsContent>

      {/* Nueva pestaña: Volumen por Tipo de Tela - Diseño Creativo */}
      <TabsContent value="tela-volume" className="mt-4">
        <div className="w-full bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl shadow-lg">
          {telaVolumeData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
              {/* Gráfica de Burbujas para Volumen vs Valor */}
              <div className="bg-white rounded-xl p-4 shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">
                  🧵 Volumen vs Valor por Tela
                </h3>
                <ResponsiveContainer width="100%" height="85%">
                  <ScatterChart
                    data={telaVolumeData.map((item, index) => ({
                      ...item,
                      size: Math.sqrt(item.totalValor / 1000) + 10, // Tamaño de burbuja basado en valor
                      color: COLORS[index % COLORS.length],
                    }))}
                    margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      dataKey="totalMetros"
                      name="Metros Totales"
                      unit="m"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) =>
                        `${formatNumber(value)}m`
                      }
                    />
                    <YAxis
                      type="number"
                      dataKey="totalValor"
                      name="Valor Total"
                      unit="USD"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) =>
                        `$${formatCurrency(value)}`
                      }
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg">
                              <p className="font-bold text-gray-800 mb-2">
                                {data.tipoTela}
                              </p>
                              <div className="space-y-1">
                                <p className="text-blue-600">
                                  📏 {formatNumber(data.totalMetros)} metros
                                </p>
                                <p className="text-green-600">
                                  💰 ${formatCurrency(data.totalValor)} USD
                                </p>
                                <p className="text-purple-600">
                                  📦 {data.orderCount} órdenes
                                </p>
                                <p className="text-orange-600">
                                  📊 $
                                  {formatCurrency(
                                    data.totalValor / data.totalMetros
                                  )}{" "}
                                  por metro
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter dataKey="size" fill="#8884d8">
                      {telaVolumeData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfica Radial para Top Telas */}
              <div className="bg-white rounded-xl p-4 shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">
                  🏆 Top 8 Telas por Valor
                </h3>
                <ResponsiveContainer width="100%" height="85%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="20%"
                    outerRadius="80%"
                    data={telaVolumeData.slice(0, 8).map((item, index) => ({
                      ...item,
                      fill: COLORS[index % COLORS.length],
                      percentage:
                        (item.totalValor /
                          Math.max(
                            ...telaVolumeData.map((d) => d.totalValor)
                          )) *
                        100,
                    }))}
                    startAngle={90}
                    endAngle={450}
                  >
                    <RadialBar
                      label={{
                        position: "insideStart",
                        fill: "#fff",
                        fontSize: 10,
                      }}
                      background={{ fill: "#f3f4f6" }}
                      dataKey="percentage"
                      cornerRadius={10}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
                              <p className="font-semibold text-gray-800">
                                {data.tipoTela}
                              </p>
                              <p className="text-green-600">
                                ${formatCurrency(data.totalValor)}
                              </p>
                              <p className="text-blue-600">
                                {formatNumber(data.totalMetros)}m
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>

              {/* Estadísticas Destacadas */}
              <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">
                  📊 Estadísticas del Volumen de Telas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {formatNumber(
                        telaVolumeData.reduce(
                          (sum, item) => sum + item.totalMetros,
                          0
                        )
                      )}
                      m
                    </div>
                    <div className="text-sm text-blue-600">Total Metros</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      $
                      {formatCurrency(
                        telaVolumeData.reduce(
                          (sum, item) => sum + item.totalValor,
                          0
                        )
                      )}
                    </div>
                    <div className="text-sm text-green-600">Valor Total</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">
                      {telaVolumeData.length}
                    </div>
                    <div className="text-sm text-purple-600">Tipos de Tela</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">
                      $
                      {formatCurrency(
                        telaVolumeData.reduce(
                          (sum, item) => sum + item.totalValor,
                          0
                        ) /
                          telaVolumeData.reduce(
                            (sum, item) => sum + item.totalMetros,
                            0
                          )
                      )}
                    </div>
                    <div className="text-sm text-orange-600">
                      Precio Promedio/m
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <NoDataMessage />
          )}
        </div>
      </TabsContent>

      {/* Nueva pestaña: Comparación FOB vs DDP - Diseño Ultra Creativo */}
      <TabsContent value="price-comparison" className="mt-4">
        <div className="w-full bg-gradient-to-br from-emerald-50 via-blue-50 to-violet-50 p-6 rounded-xl shadow-lg">
          {priceComparisonData.length > 0 ? (
            <div className="space-y-6">
              {/* Header con métricas destacadas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm">
                        Precio FOB Promedio
                      </p>
                      <p className="text-2xl font-bold">
                        $
                        {formatCurrency(
                          priceComparisonData.reduce(
                            (sum, item) => sum + item.fobUsd,
                            0
                          ) / priceComparisonData.length
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">💰</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">
                        Precio DDP Promedio
                      </p>
                      <p className="text-2xl font-bold">
                        $
                        {formatCurrency(
                          priceComparisonData.reduce(
                            (sum, item) => sum + item.ddpUsd,
                            0
                          ) / priceComparisonData.length
                        )}
                      </p>
                    </div>
                    <div className="text-3xl">🚚</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-sm">Margen Promedio</p>
                      <p className="text-2xl font-bold">
                        {(
                          ((priceComparisonData.reduce(
                            (sum, item) => sum + item.ddpUsd,
                            0
                          ) /
                            priceComparisonData.length -
                            priceComparisonData.reduce(
                              (sum, item) => sum + item.fobUsd,
                              0
                            ) /
                              priceComparisonData.length) /
                            (priceComparisonData.reduce(
                              (sum, item) => sum + item.fobUsd,
                              0
                            ) /
                              priceComparisonData.length)) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                    <div className="text-3xl">📈</div>
                  </div>
                </div>
              </div>

              {/* Gráfica principal combinada */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Gráfica compuesta área + barras */}
                <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                    🏭 Análisis de Precios FOB vs DDP
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart
                      data={priceComparisonData.map((item, index) => ({
                        ...item,
                        margen:
                          ((item.ddpUsd - item.fobUsd) / item.fobUsd) * 100,
                        index,
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                    >
                      <defs>
                        <linearGradient
                          id="fobGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10B981"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10B981"
                            stopOpacity={0.3}
                          />
                        </linearGradient>
                        <linearGradient
                          id="ddpGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3B82F6"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3B82F6"
                            stopOpacity={0.3}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="tipoTela"
                        angle={-45}
                        textAnchor="end"
                        height={120}
                        interval={0}
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                      />
                      <YAxis
                        yAxisId="price"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          `$${formatCurrency(value)}`
                        }
                      />
                      <YAxis
                        yAxisId="margin"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) =>
                          `${value.toFixed(0)}%`
                        }
                        domain={[0, "dataMax + 10"]}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl">
                                <p className="font-bold text-gray-800 mb-3">
                                  {label}
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                                    <span className="text-emerald-600">
                                      FOB: ${formatCurrency(data.fobUsd)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-blue-600">
                                      DDP: ${formatCurrency(data.ddpUsd)}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 bg-violet-500 rounded-full"></div>
                                    <span className="text-violet-600">
                                      Margen: {data.margen.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="pt-2 border-t border-gray-100">
                                    <span className="text-gray-500 text-sm">
                                      📏 {formatNumber(data.metrosKg)}{" "}
                                      {data.unidad}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Area
                        yAxisId="price"
                        type="monotone"
                        dataKey="fobUsd"
                        fill="url(#fobGradient)"
                        stroke="#10B981"
                        strokeWidth={2}
                        name="FOB (USD)"
                      />
                      <Bar
                        yAxisId="price"
                        dataKey="ddpUsd"
                        fill="#3B82F6"
                        name="DDP (USD)"
                        radius={[4, 4, 0, 0]}
                        opacity={0.8}
                      />
                      <Line
                        yAxisId="margin"
                        type="monotone"
                        dataKey="margen"
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        dot={{ fill: "#8B5CF6", strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, fill: "#8B5CF6" }}
                        name="Margen (%)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Panel lateral con rankings */}
                <div className="space-y-4">
                  {/* Top 5 mayores márgenes */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      🏆 Mayores Márgenes
                    </h4>
                    <div className="space-y-2">
                      {priceComparisonData
                        .map((item, index) => ({
                          ...item,
                          margen:
                            ((item.ddpUsd - item.fobUsd) / item.fobUsd) * 100,
                          index,
                        }))
                        .sort((a, b) => b.margen - a.margen)
                        .slice(0, 5)
                        .map((item, rank) => (
                          <div
                            key={rank}
                            className="flex items-center justify-between p-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {rank === 0
                                  ? "🥇"
                                  : rank === 1
                                    ? "🥈"
                                    : rank === 2
                                      ? "🥉"
                                      : "🏅"}
                              </span>
                              <span className="text-sm font-medium text-gray-700 truncate max-w-20">
                                {item.tipoTela.substring(0, 12)}...
                              </span>
                            </div>
                            <span className="text-sm font-bold text-orange-600">
                              {item.margen.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Telas más caras (DDP) */}
                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <h4 className="font-bold text-gray-800 mb-3">
                      💎 Precios DDP Más Altos
                    </h4>
                    <div className="space-y-2">
                      {priceComparisonData
                        .sort((a, b) => b.ddpUsd - a.ddpUsd)
                        .slice(0, 5)
                        .map((item, rank) => (
                          <div
                            key={rank}
                            className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg"
                          >
                            <span className="text-sm font-medium text-gray-700 truncate max-w-20">
                              {item.tipoTela.substring(0, 12)}...
                            </span>
                            <span className="text-sm font-bold text-blue-600">
                              ${formatCurrency(item.ddpUsd)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfica de dispersión margen vs volumen */}
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="text-xl font-bold mb-4 text-center text-gray-800">
                  💹 Análisis de Rentabilidad: Margen vs Volumen
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart
                    data={priceComparisonData.map((item) => ({
                      ...item,
                      margen: ((item.ddpUsd - item.fobUsd) / item.fobUsd) * 100,
                      size: Math.sqrt(item.metrosKg / 100) + 8,
                      efficiency: item.ddpUsd / item.metrosKg, // USD por metro
                    }))}
                    margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      dataKey="metrosKg"
                      name="Volumen Promedio"
                      unit="m"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) =>
                        `${formatNumber(value)}m`
                      }
                    />
                    <YAxis
                      type="number"
                      dataKey="margen"
                      name="Margen"
                      unit="%"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg">
                              <p className="font-bold text-gray-800 mb-2">
                                {data.tipoTela}
                              </p>
                              <div className="space-y-1">
                                <p className="text-blue-600">
                                  📊 Margen: {data.margen.toFixed(1)}%
                                </p>
                                <p className="text-green-600">
                                  📏 Volumen: {formatNumber(data.metrosKg)}m
                                </p>
                                <p className="text-purple-600">
                                  💰 FOB: ${formatCurrency(data.fobUsd)}
                                </p>
                                <p className="text-orange-600">
                                  🚚 DDP: ${formatCurrency(data.ddpUsd)}
                                </p>
                                <p className="text-gray-600">
                                  ⚡ Eficiencia: $
                                  {formatCurrency(data.efficiency)}/m
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter dataKey="size" fill="#8B5CF6">
                      {priceComparisonData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            ((entry.ddpUsd - entry.fobUsd) / entry.fobUsd) *
                              100 >
                            50
                              ? "#10B981"
                              : ((entry.ddpUsd - entry.fobUsd) / entry.fobUsd) *
                                    100 >
                                  25
                                ? "#F59E0B"
                                : "#EF4444"
                          }
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="flex justify-center mt-4 space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Alto margen (&gt;50%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Margen medio (25-50%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Bajo margen (&lt;25%)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <NoDataMessage />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
};
