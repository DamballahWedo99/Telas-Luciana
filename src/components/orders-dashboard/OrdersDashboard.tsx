import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { LogOutIcon, LayoutDashboardIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Componentes modulares
import { OrdersMetricsCard } from "./OrdersMetricsCard";
import { OrdersChartsCard } from "./OrdersChartsCard";
import { OrdersCard } from "./OrdersCard";
import { EmptyState } from "./EmptyState";

// Interfaces para los tipos de datos
interface PedidoData {
  orden_de_compra?: string;
  total_factura?: number;
  tipo_de_cambio?: number;
  total_gastos?: number;
  m_factura?: number;
  fecha_pedido?: string;
  sale_origen?: string;
  llega_a_Lazaro?: string;
  llega_a_Manzanillo?: string;
  llega_almacen_proveedor?: string;
  total_mxp?: number;
  t_cambio?: number;
  gastos_mxp?: number;
  ddp_total_mxp?: number;
  ddp_mxp_unidad?: number;
  ddp_usd_unidad?: number;
  ddp_usd_unidad_s_iva?: number;
  "pedido_cliente.tipo_tela"?: string;
  "pedido_cliente.color"?: string;
  [key: string]: any; // Para permitir acceso dinámico a propiedades
}

interface TotalsData {
  totalFactura: number;
  totalMxp: number;
  gastosMxp: number;
  ddpTotalMxp: number;
}

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

// Declaración opcional para window.fs
declare global {
  interface Window {
    fs?: {
      readFile: (path: string, options?: { encoding?: string }) => Promise<any>;
    };
  }
}

interface PedidosDashboardProps {
  onBack: () => void;
  onLogout?: () => void;
}

const PedidosDashboard: React.FC<PedidosDashboardProps> = ({
  onBack,
  onLogout,
}) => {
  // Estado de datos
  const [data, setData] = useState<PedidoData[]>([]);
  const [filteredData, setFilteredData] = useState<PedidoData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Estados UI
  const [metricsCollapsed, setMetricsCollapsed] = useState<boolean>(false);
  const [chartsCollapsed, setChartsCollapsed] = useState<boolean>(false);
  const [ordersCollapsed, setOrdersCollapsed] = useState<boolean>(false);

  // Estados de filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [ordenDeCompraFilter, setOrdenDeCompraFilter] = useState<string>("all");
  const [tipoTelaFilter, setTipoTelaFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [ubicacionFilter, setUbicacionFilter] = useState<string>("all");

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const recordsPerPage = 100;

  // Opciones de filtros
  const [ordenDeCompraOptions, setOrdenDeCompraOptions] = useState<string[]>(
    []
  );
  const [tipoTelaOptions, setTipoTelaOptions] = useState<string[]>([]);
  const [colorOptions, setColorOptions] = useState<string[]>([]);

  // Datos de totales y gráficos
  const [totals, setTotals] = useState<TotalsData>({
    totalFactura: 0,
    totalMxp: 0,
    gastosMxp: 0,
    ddpTotalMxp: 0,
  });
  const [pieChartData, setPieChartData] = useState<ChartDataItem[]>([]);
  const [barChartData, setBarChartData] = useState<BarChartDataItem[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineDataItem[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryDataItem[]>([]);

  // Función para manejar el cierre de sesión
  const handleLogout = async () => {
    if (onLogout) {
      try {
        setIsLoggingOut(true);
        await onLogout();
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        setIsLoggingOut(false);
      }
    } else {
      onBack();
    }
  };

  // Función para verificar si window.fs está disponible
  const isFsAvailable = (): boolean => {
    return window.fs !== undefined && typeof window.fs.readFile === "function";
  };

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        if (isFsAvailable() && window.fs) {
          // Si fs está disponible, intentar cargar el archivo
          const csvData = await window.fs.readFile("Pedidos_clean.csv", {
            encoding: "utf8",
          });
          processCSVData(csvData);
        } else {
          // Si fs no está disponible, mostrar un mensaje de error más amigable
          setError(
            "No se pudo acceder al sistema de archivos. Por favor, sube un archivo CSV con los datos de pedidos."
          );
          setLoading(false);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setError(
          `Error al leer el archivo: ${errorMessage}. Por favor, sube un archivo CSV manualmente.`
        );
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Función para procesar los datos CSV
  const processCSVData = (csvData: string) => {
    Papa.parse<Record<string, any>>(csvData, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors && result.errors.length > 0) {
          setError(`Error al analizar CSV: ${result.errors[0].message}`);
          setLoading(false);
          return;
        }

        try {
          // Primero, calculamos total_mxp para cada fila
          const rows: PedidoData[] = result.data.map((row) => {
            const totalFactura = row.total_factura || 0;
            const tipoDeCambio = row.tipo_de_cambio || 0;
            const totalMxp = totalFactura * tipoDeCambio;

            return {
              ...row,
              total_mxp: totalMxp,
            };
          });

          // Agrupamos por orden_de_compra para calcular la suma total_mxp para cada grupo
          const ordenGroups: Record<string, { totalMxpSum: number }> = {};
          rows.forEach((row) => {
            const ordenDeCompra = row.orden_de_compra || "";
            if (!ordenGroups[ordenDeCompra]) {
              ordenGroups[ordenDeCompra] = {
                totalMxpSum: 0,
              };
            }
            ordenGroups[ordenDeCompra].totalMxpSum += row.total_mxp || 0;
          });

          // Ahora procesamos los datos con los cálculos correctos
          const processedData: PedidoData[] = rows.map((row) => {
            // Valores predeterminados para campos nulos
            const ordenDeCompra = row.orden_de_compra || "";
            const totalFactura = row.total_factura || 0;
            const tipoDeCambio = row.tipo_de_cambio || 0;
            const totalGastos = row.total_gastos || 0;
            const mFactura = row.m_factura || 1; // Evitar división por cero
            const totalMxp = row.total_mxp || 0;

            // Obtener la suma total_mxp para esta orden_de_compra
            const totalMxpSum = ordenGroups[ordenDeCompra]?.totalMxpSum || 1; // Evitar división por cero

            // Calcular t_cambio como una proporción del total_mxp de esta fila al total para su orden_de_compra
            const tCambio = totalMxpSum > 0 ? totalMxp / totalMxpSum : 0;

            // Calcular el resto de los valores
            const gastosMxp = tCambio * totalGastos;
            const ddpTotalMxp = gastosMxp + totalMxp;
            const ddpMxpUnidad = mFactura > 0 ? ddpTotalMxp / mFactura : 0;
            const ddpUsdUnidad =
              tipoDeCambio > 0 ? ddpMxpUnidad / tipoDeCambio : 0;
            const ddpUsdUnidadSIva = ddpUsdUnidad / 1.16;

            return {
              ...row,
              // Campos calculados
              t_cambio: tCambio,
              gastos_mxp: gastosMxp,
              ddp_total_mxp: ddpTotalMxp,
              ddp_mxp_unidad: ddpMxpUnidad,
              ddp_usd_unidad: ddpUsdUnidad,
              ddp_usd_unidad_s_iva: ddpUsdUnidadSIva,
            };
          });

          setData(processedData);
          setFilteredData(processedData);

          // Extraer valores únicos para filtros
          const ordenDeCompraSet = new Set(
            processedData.map((row) => row.orden_de_compra).filter(Boolean)
          );
          const tipoTelaSet = new Set(
            processedData
              .map((row) => row["pedido_cliente.tipo_tela"])
              .filter(Boolean)
          );
          const colorSet = new Set(
            processedData
              .map((row) => row["pedido_cliente.color"])
              .filter(Boolean)
          );

          setOrdenDeCompraOptions(Array.from(ordenDeCompraSet) as string[]);
          setTipoTelaOptions(Array.from(tipoTelaSet) as string[]);
          setColorOptions(Array.from(colorSet) as string[]);

          calculateTotals(processedData);
          setError(null);
        } catch (err: any) {
          setError(`Error al procesar los datos: ${err.message}`);
          console.error("Error processing data:", err);
        } finally {
          setLoading(false);
          setFileUploading(false);
        }
      },
      error: (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setError(`Error al analizar CSV: ${errorMessage}`);
        setLoading(false);
        setFileUploading(false);
      },
    });
  };

  // Aplicar filtros cuando cambien los valores de filtro
  useEffect(() => {
    applyFilters();
  }, [
    searchQuery,
    ordenDeCompraFilter,
    tipoTelaFilter,
    colorFilter,
    ubicacionFilter,
    data,
  ]);

  const applyFilters = () => {
    if (!data.length) return;

    let filtered = [...data];

    // Aplicar filtros en orden de importancia
    if (ordenDeCompraFilter && ordenDeCompraFilter !== "all") {
      filtered = filtered.filter(
        (row) => row.orden_de_compra === ordenDeCompraFilter
      );
    }

    if (tipoTelaFilter && tipoTelaFilter !== "all") {
      filtered = filtered.filter(
        (row) => row["pedido_cliente.tipo_tela"] === tipoTelaFilter
      );
    }

    if (colorFilter && colorFilter !== "all") {
      filtered = filtered.filter(
        (row) => row["pedido_cliente.color"] === colorFilter
      );
    }

    if (ubicacionFilter && ubicacionFilter !== "all") {
      filtered = filtered.filter((row) => {
        if (ubicacionFilter === "almacen") {
          return (
            row.llega_almacen_proveedor && row.llega_almacen_proveedor !== ""
          );
        } else if (ubicacionFilter === "transito") {
          return (
            row.sale_origen &&
            row.sale_origen !== "" &&
            (!row.llega_almacen_proveedor || row.llega_almacen_proveedor === "")
          );
        } else if (ubicacionFilter === "proveedor") {
          return (
            (!row.sale_origen || row.sale_origen === "") &&
            row.fecha_pedido &&
            row.fecha_pedido !== ""
          );
        }
        return true;
      });
    }

    // Aplicar consulta de búsqueda (insensible a mayúsculas/minúsculas)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((row) => {
        return (
          (row.orden_de_compra?.toLowerCase() || "").includes(query) ||
          (row["pedido_cliente.tipo_tela"]?.toLowerCase() || "").includes(
            query
          ) ||
          (row["pedido_cliente.color"]?.toLowerCase() || "").includes(query)
        );
      });
    }

    // NUEVO: Ordenar por fecha_pedido (más reciente primero)
    filtered.sort((a, b) => {
      // Manejar casos donde la fecha_pedido podría ser undefined
      if (!a.fecha_pedido) return 1; // a va después si no tiene fecha
      if (!b.fecha_pedido) return -1; // b va después si no tiene fecha

      // Convertir a objetos Date para comparación
      const dateA = new Date(a.fecha_pedido);
      const dateB = new Date(b.fecha_pedido);

      // Ordenar de más reciente (mayor) a más antiguo (menor)
      return dateB.getTime() - dateA.getTime();
    });

    setFilteredData(filtered);
    calculateTotals(filtered);
    // Restablecer a la primera página cuando cambien los filtros
    setCurrentPage(1);
  };

  const calculateTotals = (filteredRows: PedidoData[]) => {
    const totals = filteredRows.reduce(
      (acc: TotalsData, row) => {
        acc.totalFactura += row.total_factura || 0;
        acc.totalMxp += row.total_mxp || 0;
        acc.gastosMxp += row.gastos_mxp || 0;
        acc.ddpTotalMxp += row.ddp_total_mxp || 0;
        return acc;
      },
      {
        totalFactura: 0,
        totalMxp: 0,
        gastosMxp: 0,
        ddpTotalMxp: 0,
      }
    );

    setTotals(totals);

    // Preparar datos para gráficos
    const chartData = prepareChartData(filteredRows);
    setPieChartData(chartData.pieData);
    setBarChartData(chartData.barData);
    setTimelineData(chartData.timelineData);
    setDeliveryData(chartData.deliveryData);
  };

  // Preparar datos para gráficos
  const prepareChartData = (filteredRows: PedidoData[]) => {
    // Para gráfico circular - distribución por color
    const colorGroups: Record<string, number> = {};
    filteredRows.forEach((row) => {
      const color = row["pedido_cliente.color"] || "Sin Color";
      if (!colorGroups[color]) {
        colorGroups[color] = 0;
      }
      colorGroups[color] += row.total_factura || 0;
    });

    const pieData: ChartDataItem[] = Object.keys(colorGroups)
      .map((color) => ({
        name: color,
        value: colorGroups[color],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7); // Top 7 colores

    // Para gráfico de barras - total_factura por orden_de_compra
    const ordenGroups: Record<string, number> = {};
    filteredRows.forEach((row) => {
      const orden = row.orden_de_compra || "Sin Orden";
      if (!ordenGroups[orden]) {
        ordenGroups[orden] = 0;
      }
      ordenGroups[orden] += row.total_factura || 0;
    });

    const barData: BarChartDataItem[] = Object.keys(ordenGroups)
      .map((orden) => ({
        name: orden.length > 12 ? orden.substring(0, 10) + "..." : orden,
        total: ordenGroups[orden],
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 órdenes

    // Para línea de tiempo - pedidos por fecha
    const dateGroups: Record<string, { count: number; totalFactura: number }> =
      {};
    filteredRows.forEach((row) => {
      if (!row.fecha_pedido) return;

      try {
        // Formatear fecha a YYYY-MM (año-mes)
        const date = new Date(row.fecha_pedido);
        if (isNaN(date.getTime())) return; // Omitir fechas inválidas

        const yearMonth = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        if (!dateGroups[yearMonth]) {
          dateGroups[yearMonth] = {
            count: 0,
            totalFactura: 0,
          };
        }
        dateGroups[yearMonth].count += 1;
        dateGroups[yearMonth].totalFactura += row.total_factura || 0;
      } catch (error: unknown) {
        // Omitir en errores de análisis de fecha
      }
    });

    const timelineData: TimelineDataItem[] = Object.keys(dateGroups)
      .sort() // Ordenar fechas cronológicamente
      .map((yearMonth) => ({
        date: yearMonth,
        count: dateGroups[yearMonth].count,
        total: dateGroups[yearMonth].totalFactura,
      }));

    // Para análisis de tiempo de entrega
    const deliveryData: DeliveryDataItem[] = [];
    filteredRows.forEach((row) => {
      if (!row.fecha_pedido || !row.llega_almacen_proveedor) return;

      try {
        const orderDate = new Date(row.fecha_pedido);
        const deliveryDate = new Date(row.llega_almacen_proveedor);

        if (isNaN(orderDate.getTime()) || isNaN(deliveryDate.getTime())) return;

        // Calcular diferencia de días
        const diffTime = Math.abs(deliveryDate.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) {
          // Filtrar valores irrazonables
          deliveryData.push({
            orden: row.orden_de_compra || "",
            days: diffDays,
            total: row.total_factura || 0,
          });
        }
      } catch (error: unknown) {
        // Omitir en errores de cálculo de fecha
      }
    });

    // Ordenar por tiempo de entrega
    deliveryData.sort((a, b) => a.days - b.days);

    return {
      pieData,
      barData,
      timelineData,
      deliveryData,
    };
  };

  const resetFilters = () => {
    setSearchQuery("");
    setOrdenDeCompraFilter("all");
    setTipoTelaFilter("all");
    setColorFilter("all");
    setUbicacionFilter("all");
  };

  // Lógica de paginación
  const totalPages = Math.ceil(filteredData.length / recordsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Formatear valores de moneda
  const formatCurrency = (value: number, decimals = 2): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Formatear fechas
  const formatDate = (dateString?: string): string => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Devolver original si es inválida
      return date.toLocaleDateString("es-MX");
    } catch (error: unknown) {
      return dateString; // Devolver original en caso de error
    }
  };

  // Función para manejar la carga de archivos
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      if (csvData) {
        processCSVData(csvData);
      } else {
        setError("No se pudo leer el archivo. Inténtalo de nuevo.");
        setFileUploading(false);
      }
    };
    reader.onerror = () => {
      setError("Error al leer el archivo. Inténtalo de nuevo.");
      setFileUploading(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6 my-4">
        <h1 className="text-2xl font-bold">Dashboard de Pedidos Históricos</h1>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onBack}
                  size="icon"
                  className="mr-2"
                >
                  <LayoutDashboardIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Volver al dashboard de inventario</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
            disabled={isLoggingOut}
          >
            <LogOutIcon className="h-4 w-4" />
            {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <div className="text-lg font-semibold">
              Cargando datos históricos...
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col gap-6">
          <Alert variant="destructive" className="mb-2">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>

          <EmptyState
            title="Cargar archivo CSV de pedidos"
            description="Puedes cargar un archivo CSV con los datos de pedidos para visualizar en el dashboard. El archivo debe tener columnas como: orden_de_compra, total_factura, tipo_de_cambio, etc."
            handleFileUpload={handleFileUpload}
            fileUploading={fileUploading}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Métricas Card */}
          <OrdersMetricsCard
            totals={totals}
            filteredDataLength={filteredData.length}
            metricsCollapsed={metricsCollapsed}
            setMetricsCollapsed={setMetricsCollapsed}
          />

          {/* Visualizaciones Card */}
          <OrdersChartsCard
            pieChartData={pieChartData}
            barChartData={barChartData}
            timelineData={timelineData}
            deliveryData={deliveryData}
            chartsCollapsed={chartsCollapsed}
            setChartsCollapsed={setChartsCollapsed}
            dataLength={data.length}
          />

          {/* Órdenes de Compra Card */}
          <OrdersCard
            data={data}
            filteredData={filteredData}
            paginatedData={paginatedData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            ordenDeCompraFilter={ordenDeCompraFilter}
            setOrdenDeCompraFilter={setOrdenDeCompraFilter}
            tipoTelaFilter={tipoTelaFilter}
            setTipoTelaFilter={setTipoTelaFilter}
            colorFilter={colorFilter}
            setColorFilter={setColorFilter}
            ubicacionFilter={ubicacionFilter}
            setUbicacionFilter={setUbicacionFilter}
            ordenDeCompraOptions={ordenDeCompraOptions}
            tipoTelaOptions={tipoTelaOptions}
            colorOptions={colorOptions}
            handleFileUpload={handleFileUpload}
            fileUploading={fileUploading}
            resetFilters={resetFilters}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            currentPage={currentPage}
            totalPages={totalPages}
            goToPage={goToPage}
            ordersCollapsed={ordersCollapsed}
            setOrdersCollapsed={setOrdersCollapsed}
          />
        </div>
      )}
    </div>
  );
};

export default PedidosDashboard;
