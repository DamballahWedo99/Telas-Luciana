import React, { useState, useEffect, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { OrdersMetricsSection } from "./OrdersMetricsSection";
import { OrdersChartsCard } from "./OrdersChartsCard";
import { OrdersCard } from "./OrdersCard";
import { PriceHistoryCard } from "./PriceHistoryCard";

interface PedidoData {
  num_archivo?: number;
  proveedor?: string;
  contacto?: string;
  email?: string;
  teléfono?: number;
  celular?: number;
  origen?: string;
  incoterm?: string;
  transportista?: string;
  agente_aduanal?: string;
  pedimento?: string;
  fecha_pedido?: string;
  sale_origen?: string;
  pago_credito?: string | null;
  llega_a_Lazaro?: string;
  llega_a_Manzanillo?: string;
  llega_almacen_proveedor?: string;
  factura_proveedor?: string;
  orden_de_compra?: string;
  reporte_inspeccion?: string | null;
  pedimento_tránsito?: string | null;
  "pedido_cliente.tipo_tela"?: string;
  "pedido_cliente.color"?: string;
  "pedido_cliente.total_m_pedidos"?: number;
  "pedido_cliente.unidad"?: string;
  precio_m_fob_usd?: number;
  total_x_color_fob_usd?: number;
  m_factura?: number;
  total_factura?: number;
  fraccion?: string;
  "supplier_percent_diff or upon negotiation"?: number;
  Year?: number;
  total_gastos?: number;
  tipo_de_cambio?: number;
  venta?: number;
  total_mxp?: number;
  t_cambio?: number;
  gastos_mxp?: number;
  ddp_total_mxp?: number;
  ddp_mxp_unidad?: number;
  ddp_usd_unidad?: number;
  ddp_usd_unidad_s_iva?: number;
  [key: string]: string | number | null | undefined;
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

interface NestedPedidoData {
  orden_de_compra: string;
  items: PedidoData[];
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

  const [chartsCollapsed, setChartsCollapsed] = useState<boolean>(true);
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
  const [yearlyOrdersData, setYearlyOrdersData] = useState<
    YearlyOrdersDataItem[]
  >([]);
  const [telaVolumeData, setTelaVolumeData] = useState<TelaVolumeDataItem[]>(
    []
  );
  const [priceComparisonData, setPriceComparisonData] = useState<
    PriceComparisonDataItem[]
  >([]);

  const prepareChartData = useCallback((filteredRows: PedidoData[]) => {
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

    const pieData: ChartDataItem[] = Object.keys(colorGroups)
      .map((color) => ({
        name: color,
        value: colorGroups[color],
      }))
      .sort((a, b) => b.value - a.value);

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
      const ordenCompra = String(row.orden_de_compra || "");

      const fechaEntrega =
        row.llega_almacen_proveedor ||
        row.llega_a_Manzanillo ||
        row.llega_a_Lazaro ||
        row["llega_a_Lazaro?"] ||
        row.sale_origen;

      if (!row.fecha_pedido || !fechaEntrega) {
        return;
      }

      try {
        const orderDate = new Date(String(row.fecha_pedido));
        const deliveryDate = new Date(String(fechaEntrega));

        if (isNaN(orderDate.getTime()) || isNaN(deliveryDate.getTime())) {
          return;
        }

        const diffTime = Math.abs(deliveryDate.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) {
          deliveryData.push({
            orden: ordenCompra,
            days: diffDays,
            total: Number(row.total_factura) || 0,
          });
        }
      } catch (error) {
        // Silently handle invalid dates
      }
    });

    deliveryData.sort((a, b) => a.days - b.days);

    // 1. Preparar datos para gráfica de órdenes por año
    const yearGroups: Record<
      number,
      { totalFactura: number; orderCount: number }
    > = {};
    filteredRows.forEach((row) => {
      const year = row.Year || new Date(row.fecha_pedido || "").getFullYear();
      if (year && !isNaN(year)) {
        if (!yearGroups[year]) {
          yearGroups[year] = { totalFactura: 0, orderCount: 0 };
        }
        yearGroups[year].totalFactura += Number(row.total_factura) || 0;
        yearGroups[year].orderCount += 1;
      }
    });

    const yearlyOrdersData: YearlyOrdersDataItem[] = Object.keys(yearGroups)
      .map((year) => ({
        year: parseInt(year),
        totalFactura: yearGroups[parseInt(year)].totalFactura,
        orderCount: yearGroups[parseInt(year)].orderCount,
      }))
      .sort((a, b) => a.year - b.year);

    // 2. Preparar datos para volumen por tipo de tela
    const telaVolumeGroups: Record<
      string,
      { totalMetros: number; totalValor: number; orderCount: number }
    > = {};
    filteredRows.forEach((row) => {
      const tela = row["pedido_cliente.tipo_tela"] || "Sin Especificar";
      const metros = Number(row["pedido_cliente.total_m_pedidos"]) || 0;
      const valor = Number(row.total_factura) || 0;

      if (!telaVolumeGroups[tela]) {
        telaVolumeGroups[tela] = {
          totalMetros: 0,
          totalValor: 0,
          orderCount: 0,
        };
      }
      telaVolumeGroups[tela].totalMetros += metros;
      telaVolumeGroups[tela].totalValor += valor;
      telaVolumeGroups[tela].orderCount += 1;
    });

    const telaVolumeData: TelaVolumeDataItem[] = Object.keys(telaVolumeGroups)
      .map((tela) => ({
        tipoTela: tela,
        totalMetros: telaVolumeGroups[tela].totalMetros,
        totalValor: telaVolumeGroups[tela].totalValor,
        orderCount: telaVolumeGroups[tela].orderCount,
      }))
      .sort((a, b) => b.totalValor - a.totalValor)
      .slice(0, 15); // Top 15 telas

    // 3. Preparar datos para comparación FOB vs DDP
    const priceGroups: Record<
      string,
      {
        fobSum: number;
        ddpSum: number;
        metrosSum: number;
        count: number;
        unidad: string;
      }
    > = {};
    filteredRows.forEach((row) => {
      const tela = row["pedido_cliente.tipo_tela"] || "Sin Especificar";
      const fob = Number(row.precio_m_fob_usd) || 0;
      const ddp = Number(row.ddp_usd_unidad) || 0;
      const metros = Number(row["pedido_cliente.total_m_pedidos"]) || 0;
      const unidad = row["pedido_cliente.unidad"] || "m";

      if (fob > 0 && ddp > 0) {
        if (!priceGroups[tela]) {
          priceGroups[tela] = {
            fobSum: 0,
            ddpSum: 0,
            metrosSum: 0,
            count: 0,
            unidad,
          };
        }
        priceGroups[tela].fobSum += fob;
        priceGroups[tela].ddpSum += ddp;
        priceGroups[tela].metrosSum += metros;
        priceGroups[tela].count += 1;
      }
    });

    const priceComparisonData: PriceComparisonDataItem[] = Object.keys(
      priceGroups
    )
      .filter((tela) => priceGroups[tela].count > 0)
      .map((tela) => ({
        tipoTela: tela,
        fobUsd: priceGroups[tela].fobSum / priceGroups[tela].count,
        ddpUsd: priceGroups[tela].ddpSum / priceGroups[tela].count,
        metrosKg: priceGroups[tela].metrosSum / priceGroups[tela].count,
        unidad: priceGroups[tela].unidad,
      }))
      .sort((a, b) => b.ddpUsd - a.ddpUsd)
      .slice(0, 10); // Top 10 telas por precio DDP


    return {
      pieData,
      barData,
      timelineData,
      deliveryData,
      yearlyOrdersData,
      telaVolumeData,
      priceComparisonData,
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
      setYearlyOrdersData(chartData.yearlyOrdersData);
      setTelaVolumeData(chartData.telaVolumeData);
      setPriceComparisonData(chartData.priceComparisonData);
    },
    [prepareChartData]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/s3/pedidos");

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        if (result.data && Array.isArray(result.data)) {
          const flattenedData: PedidoData[] = [];

          result.data.forEach((item: NestedPedidoData | PedidoData) => {
            if (
              "items" in item &&
              item.orden_de_compra &&
              Array.isArray(item.items)
            ) {
              item.items.forEach((subItem: PedidoData) => {
                flattenedData.push({
                  ...subItem,
                  orden_de_compra: item.orden_de_compra,
                });
              });
            } else {
              flattenedData.push(item as PedidoData);
            }
          });

          const processedData: PedidoData[] = flattenedData.map(
            (row: PedidoData) => {
              const tipoDeCambio = Number(row.tipo_de_cambio) || 0;
              const totalMxp = (Number(row.total_factura) || 0) * tipoDeCambio;

              // Migrar campos antiguos al nuevo campo llega_a_mexico si no existe
              let llegaAMexico = row.llega_a_mexico;
              if (!llegaAMexico) {
                llegaAMexico =
                  row.llega_a_Lazaro || row.llega_a_Manzanillo || "";
              }

              return {
                ...row,
                total_mxp: totalMxp,
                llega_a_mexico: llegaAMexico,
              };
            }
          );

          const ordenGroups: Record<string, { totalMxpSum: number }> = {};
          processedData.forEach((row) => {
            const ordenDeCompra = row.orden_de_compra || "";
            if (!ordenGroups[ordenDeCompra]) {
              ordenGroups[ordenDeCompra] = {
                totalMxpSum: 0,
              };
            }
            ordenGroups[ordenDeCompra].totalMxpSum += row.total_mxp || 0;
          });

          const finalData: PedidoData[] = processedData.map((row) => {
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

          setData(finalData);
          setFilteredData(finalData);
          calculateTotals(finalData);
          setError(null);
        } else {
          throw new Error("No se recibieron datos válidos del servidor");
        }
      } catch (fetchError: unknown) {
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        setError(`Error al obtener los datos: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [calculateTotals]);

  const applyFilters = useCallback(() => {
    if (!data.length) return;

    let filtered = [...data];

    if (ordenDeCompraFilter && ordenDeCompraFilter !== "all") {
      filtered = filtered.filter(
        (row) => row.orden_de_compra === ordenDeCompraFilter
      );
    }

    if (tipoTelaFilter && tipoTelaFilter !== "all") {
      filtered = filtered.filter((row) => {
        const tela =
          row["pedido_cliente.tipo_tela"] ||
          row["pedido_cliente_tipo_tela"] ||
          row["tipo_tela"] ||
          row["tela"] ||
          "Sin Especificar";
        return String(tela).trim() === tipoTelaFilter;
      });
    }

    if (colorFilter && colorFilter !== "all") {
      filtered = filtered.filter((row) => {
        const color =
          row["pedido_cliente.color"] ||
          row["pedido_cliente_color"] ||
          row["color"] ||
          "Sin Especificar";
        return String(color).trim() === colorFilter;
      });
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

    if (searchQuery) {
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
    }

    filtered.sort((a, b) => {
      if (!a.fecha_pedido) return 1;
      if (!b.fecha_pedido) return -1;

      const dateA = new Date(String(a.fecha_pedido));
      const dateB = new Date(String(b.fecha_pedido));

      return dateB.getTime() - dateA.getTime();
    });

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

  // Función para refrescar datos después de una actualización
  const handleDataUpdate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/s3/pedidos?refresh=true");

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.data && Array.isArray(result.data)) {
        const flattenedData: PedidoData[] = [];

        result.data.forEach((item: NestedPedidoData | PedidoData) => {
          if (
            "items" in item &&
            item.orden_de_compra &&
            Array.isArray(item.items)
          ) {
            item.items.forEach((subItem: PedidoData) => {
              flattenedData.push({
                ...subItem,
                orden_de_compra: item.orden_de_compra,
              });
            });
          } else {
            flattenedData.push(item as PedidoData);
          }
        });

        const processedData = flattenedData.map((row: PedidoData) => {
          const tipoDeCambio = Number(row.tipo_de_cambio) || 0;
          const totalMxp = (Number(row.total_factura) || 0) * tipoDeCambio;

          // Migrar campos antiguos al nuevo campo llega_a_mexico si no existe
          let llegaAMexico = row.llega_a_mexico;
          if (!llegaAMexico) {
            llegaAMexico = row.llega_a_Lazaro || row.llega_a_Manzanillo || "";
          }

          return {
            ...row,
            total_mxp: totalMxp,
            llega_a_mexico: llegaAMexico,
          };
        });

        // Calcular campos DDP igual que en el useEffect original
        const ordenGroups: Record<string, { totalMxpSum: number }> = {};
        processedData.forEach((row: PedidoData) => {
          const ordenDeCompra = row.orden_de_compra || "";
          if (!ordenGroups[ordenDeCompra]) {
            ordenGroups[ordenDeCompra] = { totalMxpSum: 0 };
          }
          ordenGroups[ordenDeCompra].totalMxpSum += row.total_mxp || 0;
        });

        const finalData = processedData.map((row: PedidoData) => {
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

        setData(finalData);
        setFilteredData(finalData);
        calculateTotals(finalData);
      }
    } catch (error) {
      setError("Error al refrescar los datos");
    } finally {
      setLoading(false);
    }
  }, [calculateTotals]);

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

  return (
    <div>
      {error ? (
        <div className="flex flex-col gap-6">
          <Alert variant="destructive" className="mb-2">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="hidden md:block">
            <OrdersMetricsSection
              totals={totals}
              filteredDataLength={filteredData.length}
            />
          </div>

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
            resetFilters={resetFilters}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            currentPage={currentPage}
            totalPages={totalPages}
            goToPage={goToPage}
            ordersCollapsed={ordersCollapsed}
            setOrdersCollapsed={setOrdersCollapsed}
            onDataUpdate={handleDataUpdate}
            loading={loading}
          />

          <div className="hidden md:block">
            <OrdersChartsCard
              pieChartData={pieChartData}
              barChartData={barChartData}
              timelineData={timelineData}
              deliveryData={deliveryData}
              yearlyOrdersData={yearlyOrdersData}
              telaVolumeData={telaVolumeData}
              priceComparisonData={priceComparisonData}
              chartsCollapsed={chartsCollapsed}
              setChartsCollapsed={setChartsCollapsed}
              dataLength={data.length}
              searchQuery={searchQuery}
              ordenDeCompraFilter={ordenDeCompraFilter}
              tipoTelaFilter={tipoTelaFilter}
              colorFilter={colorFilter}
              ubicacionFilter={ubicacionFilter}
            />

            <div className="hidden md:block">
              <PriceHistoryCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosDashboard;
