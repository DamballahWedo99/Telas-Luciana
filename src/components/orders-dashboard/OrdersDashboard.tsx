import React, { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { OrdersMetricsCard } from "./OrdersMetricsCard";
import { OrdersChartsCard } from "./OrdersChartsCard";
import { OrdersCard } from "./OrdersCard";
import { EmptyState } from "./EmptyState";

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
  [key: string]: string | number | undefined;
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

declare global {
  interface Window {
    fs?: {
      readFile: (
        path: string,
        options?: { encoding?: string }
      ) => Promise<string>;
    };
  }
}

const PedidosDashboard: React.FC = () => {
  const [data, setData] = useState<PedidoData[]>([]);
  const [filteredData, setFilteredData] = useState<PedidoData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState<boolean>(false);

  const [metricsCollapsed, setMetricsCollapsed] = useState<boolean>(false);
  const [chartsCollapsed, setChartsCollapsed] = useState<boolean>(false);
  const [ordersCollapsed, setOrdersCollapsed] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [ordenDeCompraFilter, setOrdenDeCompraFilter] = useState<string>("all");
  const [tipoTelaFilter, setTipoTelaFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [ubicacionFilter, setUbicacionFilter] = useState<string>("all");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const recordsPerPage = 100;

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

  const isFsAvailable = (): boolean => {
    return window.fs !== undefined && typeof window.fs.readFile === "function";
  };

  const prepareChartData = useCallback((filteredRows: PedidoData[]) => {
    console.log(
      `🔍 Preparando datos de gráficos para ${filteredRows.length} filas`
    );

    const colorGroups: Record<string, number> = {};
    const telaGroups: Record<string, number> = {};

    filteredRows.forEach((row) => {
      const color =
        row["pedido_cliente.color"] ||
        row["pedido_cliente_color"] ||
        row["color"] ||
        "Sin Color";

      const tela =
        row["pedido_cliente.tipo_tela"] ||
        row["pedido_cliente_tipo_tela"] ||
        row["tipo_tela"] ||
        row["tela"] ||
        "Sin Tela";

      const colorKey = String(color).trim();
      const telaKey = String(tela).trim();
      const facturaValue = Number(row.total_factura) || 0;

      if (!colorGroups[colorKey]) {
        colorGroups[colorKey] = 0;
      }
      colorGroups[colorKey] += facturaValue;

      if (!telaGroups[telaKey]) {
        telaGroups[telaKey] = 0;
      }
      telaGroups[telaKey] += facturaValue;
    });

    console.log(
      `📊 Colores encontrados (${Object.keys(colorGroups).length}):`,
      Object.keys(colorGroups)
    );
    console.log(
      `📊 Telas encontradas (${Object.keys(telaGroups).length}):`,
      Object.keys(telaGroups)
    );

    const pieData: ChartDataItem[] = Object.keys(colorGroups)
      .map((color) => ({
        name: color,
        value: colorGroups[color],
      }))
      .sort((a, b) => b.value - a.value);

    console.log(`✅ Datos de colores preparados: ${pieData.length} elementos`);

    const ordenGroups: Record<string, number> = {};
    filteredRows.forEach((row) => {
      const orden = row.orden_de_compra || "Sin Orden";
      if (!ordenGroups[orden]) {
        ordenGroups[orden] = 0;
      }
      ordenGroups[orden] += Number(row.total_factura) || 0;
    });

    const barData: BarChartDataItem[] = Object.keys(ordenGroups)
      .map((orden) => ({
        name: orden,
        fullName: orden,
        total: ordenGroups[orden],
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const dateGroups: Record<string, { count: number; totalFactura: number }> =
      {};
    filteredRows.forEach((row) => {
      if (!row.fecha_pedido) return;

      try {
        const date = new Date(String(row.fecha_pedido));
        if (isNaN(date.getTime())) return;

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
        dateGroups[yearMonth].totalFactura += Number(row.total_factura) || 0;
      } catch {}
    });

    const timelineData: TimelineDataItem[] = Object.keys(dateGroups)
      .sort()
      .map((yearMonth) => ({
        date: yearMonth,
        count: dateGroups[yearMonth].count,
        total: dateGroups[yearMonth].totalFactura,
      }));

    const deliveryData: DeliveryDataItem[] = [];
    filteredRows.forEach((row) => {
      if (!row.fecha_pedido || !row.llega_almacen_proveedor) return;

      try {
        const orderDate = new Date(String(row.fecha_pedido));
        const deliveryDate = new Date(String(row.llega_almacen_proveedor));

        if (isNaN(orderDate.getTime()) || isNaN(deliveryDate.getTime())) return;

        const diffTime = Math.abs(deliveryDate.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) {
          deliveryData.push({
            orden: String(row.orden_de_compra || ""),
            days: diffDays,
            total: Number(row.total_factura) || 0,
          });
        }
      } catch {}
    });

    deliveryData.sort((a, b) => a.days - b.days);

    console.log(`✅ Datos de gráficos preparados:`, {
      colores: pieData.length,
      ordenes: barData.length,
      timeline: timelineData.length,
      delivery: deliveryData.length,
    });

    return {
      pieData,
      barData,
      timelineData,
      deliveryData,
    };
  }, []);

  const calculateTotals = useCallback(
    (filteredRows: PedidoData[]) => {
      const totals = filteredRows.reduce(
        (acc: TotalsData, row) => {
          acc.totalFactura += Number(row.total_factura) || 0;
          acc.totalMxp += Number(row.total_mxp) || 0;
          acc.gastosMxp += Number(row.gastos_mxp) || 0;
          acc.ddpTotalMxp += Number(row.ddp_total_mxp) || 0;
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

      const chartData = prepareChartData(filteredRows);
      setPieChartData(chartData.pieData);
      setBarChartData(chartData.barData);
      setTimelineData(chartData.timelineData);
      setDeliveryData(chartData.deliveryData);
    },
    [prepareChartData]
  );

  const processCSVData = useCallback(
    (csvData: string) => {
      Papa.parse<Record<string, string | number>>(csvData, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.errors && result.errors.length > 0) {
            console.error("❌ Errores en CSV:", result.errors);
            setError(`Error al analizar CSV: ${result.errors[0].message}`);
            setLoading(false);
            return;
          }

          try {
            console.log("📄 Columnas encontradas en CSV:", result.meta.fields);
            console.log(
              "📊 Primeras 3 filas de datos:",
              result.data.slice(0, 3)
            );

            const rows: PedidoData[] = result.data.map((row) => {
              const tipoDeCambio = Number(row.tipo_de_cambio) || 0;
              const totalMxp = (Number(row.total_factura) || 0) * tipoDeCambio;

              return {
                ...row,
                total_mxp: totalMxp,
              };
            });

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

            const processedData: PedidoData[] = rows.map((row) => {
              const ordenDeCompra = row.orden_de_compra || "";
              const tipoDeCambio = Number(row.tipo_de_cambio) || 0;
              const totalGastos = Number(row.total_gastos) || 0;
              const mFactura = Number(row.m_factura) || 1;
              const totalMxp = row.total_mxp || 0;

              const totalMxpSum = ordenGroups[ordenDeCompra]?.totalMxpSum || 1;

              const tCambio = totalMxpSum > 0 ? totalMxp / totalMxpSum : 0;

              const gastosMxp = tCambio * totalGastos;
              const ddpTotalMxp = gastosMxp + totalMxp;
              const ddpMxpUnidad = mFactura > 0 ? ddpTotalMxp / mFactura : 0;
              const ddpUsdUnidad =
                tipoDeCambio > 0 ? ddpMxpUnidad / tipoDeCambio : 0;
              const ddpUsdUnidadSIva = ddpUsdUnidad / 1.16;

              return {
                ...row,
                t_cambio: tCambio,
                gastos_mxp: gastosMxp,
                ddp_total_mxp: ddpTotalMxp,
                ddp_mxp_unidad: ddpMxpUnidad,
                ddp_usd_unidad: ddpUsdUnidad,
                ddp_usd_unidad_s_iva: ddpUsdUnidadSIva,
              };
            });

            const tipoTelaSet = new Set<string>();
            const colorSet = new Set<string>();
            const ordenSet = new Set<string>();

            processedData.forEach((row) => {
              const tipoTela =
                row["pedido_cliente.tipo_tela"] ||
                row["pedido_cliente_tipo_tela"] ||
                row["tipo_tela"] ||
                row["tela"] ||
                "Sin Especificar";

              const color =
                row["pedido_cliente.color"] ||
                row["pedido_cliente_color"] ||
                row["color"] ||
                "Sin Especificar";

              const orden = row["orden_de_compra"] || "Sin Orden";

              tipoTelaSet.add(String(tipoTela).trim());
              colorSet.add(String(color).trim());
              ordenSet.add(String(orden).trim());
            });

            const tipoTelaArray = Array.from(tipoTelaSet).sort();
            const colorArray = Array.from(colorSet).sort();
            const ordenArray = Array.from(ordenSet).sort();

            console.log(`✅ Opciones extraídas:`);
            console.log(`   - Telas (${tipoTelaArray.length}):`, tipoTelaArray);
            console.log(`   - Colores (${colorArray.length}):`, colorArray);
            console.log(
              `   - Órdenes (${ordenArray.length}):`,
              ordenArray.slice(0, 10),
              "..."
            );

            setData(processedData);
            setFilteredData(processedData);
            calculateTotals(processedData);
            setError(null);
          } catch (err: unknown) {
            console.error("❌ Error procesando datos:", err);
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            setError(`Error al procesar los datos: ${errorMessage}`);
          } finally {
            setLoading(false);
            setFileUploading(false);
          }
        },
        error: (parseError: unknown) => {
          console.error("❌ Error parseando CSV:", parseError);
          const errorMessage =
            parseError instanceof Error
              ? parseError.message
              : String(parseError);
          setError(`Error al analizar CSV: ${errorMessage}`);
          setLoading(false);
          setFileUploading(false);
        },
      });
    },
    [calculateTotals]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        if (isFsAvailable() && window.fs) {
          const csvData = await window.fs.readFile("Pedidos_clean.csv", {
            encoding: "utf8",
          });
          processCSVData(csvData);
        } else {
          setError(
            "No se pudo acceder al sistema de archivos. Por favor, sube un archivo CSV con los datos de pedidos."
          );
          setLoading(false);
        }
      } catch (fetchError: unknown) {
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        setError(
          `Error al leer el archivo: ${errorMessage}. Por favor, sube un archivo CSV manualmente.`
        );
        setLoading(false);
      }
    };

    fetchData();
  }, [processCSVData]);

  const applyFilters = useCallback(() => {
    if (!data.length) return;

    console.log(`🔍 Aplicando filtros a ${data.length} registros`);

    let filtered = [...data];

    if (ordenDeCompraFilter && ordenDeCompraFilter !== "all") {
      const beforeCount = filtered.length;
      filtered = filtered.filter(
        (row) => row.orden_de_compra === ordenDeCompraFilter
      );
      console.log(
        `🔍 Filtro de orden '${ordenDeCompraFilter}': ${beforeCount} → ${filtered.length}`
      );
    }

    if (tipoTelaFilter && tipoTelaFilter !== "all") {
      const beforeCount = filtered.length;
      filtered = filtered.filter((row) => {
        const tela =
          row["pedido_cliente.tipo_tela"] ||
          row["pedido_cliente_tipo_tela"] ||
          row["tipo_tela"] ||
          row["tela"] ||
          "Sin Especificar";
        return String(tela).trim() === tipoTelaFilter;
      });
      console.log(
        `🔍 Filtro de tela '${tipoTelaFilter}': ${beforeCount} → ${filtered.length}`
      );
    }

    if (colorFilter && colorFilter !== "all") {
      const beforeCount = filtered.length;
      filtered = filtered.filter((row) => {
        const color =
          row["pedido_cliente.color"] ||
          row["pedido_cliente_color"] ||
          row["color"] ||
          "Sin Especificar";
        return String(color).trim() === colorFilter;
      });
      console.log(
        `🔍 Filtro de color '${colorFilter}': ${beforeCount} → ${filtered.length}`
      );
    }

    if (ubicacionFilter && ubicacionFilter !== "all") {
      const beforeCount = filtered.length;
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
      console.log(
        `🔍 Filtro de ubicación '${ubicacionFilter}': ${beforeCount} → ${filtered.length}`
      );
    }

    if (searchQuery) {
      const beforeCount = filtered.length;
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((row) => {
        const ordenDeCompra = String(row.orden_de_compra || "").toLowerCase();
        const tipoTela = String(
          row["pedido_cliente.tipo_tela"] ||
            row["pedido_cliente_tipo_tela"] ||
            row["tipo_tela"] ||
            row["tela"] ||
            ""
        ).toLowerCase();
        const color = String(
          row["pedido_cliente.color"] ||
            row["pedido_cliente_color"] ||
            row["color"] ||
            ""
        ).toLowerCase();

        return (
          ordenDeCompra.includes(query) ||
          tipoTela.includes(query) ||
          color.includes(query)
        );
      });
      console.log(
        `🔍 Filtro de búsqueda '${searchQuery}': ${beforeCount} → ${filtered.length}`
      );
    }

    filtered.sort((a, b) => {
      if (!a.fecha_pedido) return 1;
      if (!b.fecha_pedido) return -1;

      const dateA = new Date(String(a.fecha_pedido));
      const dateB = new Date(String(b.fecha_pedido));

      return dateB.getTime() - dateA.getTime();
    });

    console.log(
      `✅ Filtros aplicados: ${data.length} → ${filtered.length} registros`
    );

    setFilteredData(filtered);
    calculateTotals(filtered);
    setCurrentPage(1);
  }, [
    data,
    ordenDeCompraFilter,
    tipoTelaFilter,
    colorFilter,
    ubicacionFilter,
    searchQuery,
    calculateTotals,
  ]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const resetFilters = () => {
    setSearchQuery("");
    setOrdenDeCompraFilter("all");
    setTipoTelaFilter("all");
    setColorFilter("all");
    setUbicacionFilter("all");
  };

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

  const formatCurrency = (value: number, decimals = 2): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("es-MX");
    } catch {
      return dateString;
    }
  };

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
    <div className="max-w-7xl">
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
          <OrdersMetricsCard
            totals={totals}
            filteredDataLength={filteredData.length}
            metricsCollapsed={metricsCollapsed}
            setMetricsCollapsed={setMetricsCollapsed}
          />

          <OrdersChartsCard
            pieChartData={pieChartData}
            barChartData={barChartData}
            timelineData={timelineData}
            deliveryData={deliveryData}
            chartsCollapsed={chartsCollapsed}
            setChartsCollapsed={setChartsCollapsed}
            dataLength={data.length}
            searchQuery={searchQuery}
            ordenDeCompraFilter={ordenDeCompraFilter}
            tipoTelaFilter={tipoTelaFilter}
            colorFilter={colorFilter}
            ubicacionFilter={ubicacionFilter}
          />

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
