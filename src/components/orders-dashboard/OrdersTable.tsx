import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";

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

interface OrdersTableProps {
  filteredData: PedidoData[];
  paginatedData: PedidoData[];
  formatDate: (dateString?: string) => string;
  formatCurrency: (value: number, decimals?: number) => string;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  filteredData,
  paginatedData,
  formatDate,
  formatCurrency,
  currentPage,
  totalPages,
  goToPage,
}) => {
  // Función para generar los números de página para la paginación
  const getPageNumbers = () => {
    const pages = [];

    // Siempre mostrar primera página
    pages.push(1);

    // Mostrar páginas cercanas a la actual
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      if (i === 2 && currentPage > 3) {
        pages.push("ellipsis1");
      } else if (i === totalPages - 1 && currentPage < totalPages - 2) {
        pages.push("ellipsis2");
      } else {
        pages.push(i);
      }
    }

    // Siempre mostrar última página si hay más de una
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    // Eliminar duplicados
    return Array.from(new Set(pages));
  };

  // Verificar que paginatedData tenga elementos antes de mostrar
  const hasData = paginatedData && paginatedData.length > 0;

  // Calcular total_mxp_sum para cada orden_de_compra (siguiendo la lógica de paste.txt)
  const calculateOrdenGroups = () => {
    const ordenGroups: Record<string, { totalMxpSum: number }> = {};

    // Primero, calculamos el total_mxp para cada fila y acumulamos por orden_de_compra
    filteredData.forEach((row) => {
      const ordenDeCompra = row.orden_de_compra || "";
      const totalFactura = row.total_factura || 0;
      const tipoDeCambio = row.tipo_de_cambio || 0;
      const totalMxp = totalFactura * tipoDeCambio;

      if (!ordenGroups[ordenDeCompra]) {
        ordenGroups[ordenDeCompra] = {
          totalMxpSum: 0,
        };
      }
      ordenGroups[ordenDeCompra].totalMxpSum += totalMxp;
    });

    return ordenGroups;
  };

  // Obtener grupos de órdenes para cálculos
  const ordenGroups = calculateOrdenGroups();

  // Calcular valores para cada fila según la lógica de paste.txt
  const calculateRowData = (row: PedidoData) => {
    // Extraer valores base (con valores predeterminados para evitar cálculos con undefined/null)
    const ordenDeCompra = row.orden_de_compra || "";
    const totalFactura = row.total_factura || 0;
    const tipoDeCambio = row.tipo_de_cambio || 0;
    const totalGastos = row.total_gastos || 0;
    const mFactura = row.m_factura || 1; // Evitar división por cero

    // PASO 1: Calcular total_mxp (conversión pesos)
    const totalMxp = totalFactura * tipoDeCambio;

    // PASO 2: Obtener la suma total_mxp para esta orden_de_compra
    const totalMxpSum = ordenGroups[ordenDeCompra]?.totalMxpSum || 1; // Evitar división por cero

    // PASO 3: Calcular t_cambio como proporción del total_mxp de esta fila al total para su orden_de_compra
    const tCambio = totalMxpSum > 0 ? totalMxp / totalMxpSum : 0;

    // PASO 4: Calcular gastos en pesos
    const gastosMxp = tCambio * totalGastos;

    // PASO 5: Calcular DDP total en pesos
    const ddpTotalMxp = gastosMxp + totalMxp;

    // PASO 6: Calcular DDP por unidad en pesos
    const ddpMxpUnidad = mFactura > 0 ? ddpTotalMxp / mFactura : 0;

    // PASO 7: Calcular DDP por unidad en dólares
    const ddpUsdUnidad = tipoDeCambio > 0 ? ddpMxpUnidad / tipoDeCambio : 0;

    // PASO 8: Calcular DDP por unidad en dólares sin IVA
    const ddpUsdUnidadSIva = ddpUsdUnidad / 1.16;

    return {
      totalMxp,
      tCambio,
      gastosMxp,
      ddpTotalMxp,
      ddpMxpUnidad,
      ddpUsdUnidad,
      ddpUsdUnidadSIva,
    };
  };

  return (
    <div className="bg-white rounded shadow-sm mb-6">
      {/* Tabla con encabezado fijo inspirado en InventoryCard.tsx */}
      <div className="border rounded-md overflow-hidden">
        <div className="h-[500px] overflow-auto relative">
          <table className="w-full text-sm border-collapse min-w-[2500px]">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[180px]">
                  Orden de Compra
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[180px]">
                  Tipo de Tela
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Color
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Total Factura (USD)
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Total MXP
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[100px]">
                  T. Cambio
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Gastos MXP
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  DDP Total MXP
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  DDP MXP/Unidad
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  DDP USD/Unidad
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[160px]">
                  DDP USD/Unidad S/IVA
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Fecha Pedido
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Sale Origen
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[120px]">
                  Llega a Lázaro
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Llega a Manzanillo
                </th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground border-b w-[140px]">
                  Llega Almacén
                </th>
              </tr>
            </thead>
            <tbody>
              {!hasData ? (
                <tr>
                  <td
                    colSpan={16}
                    className="p-2 align-middle text-center h-24"
                  >
                    No se encontraron resultados para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => {
                  // Calcular valores para cada celda usando la lógica actualizada
                  const calculatedData = calculateRowData(row);

                  return (
                    <tr
                      key={index}
                      className={`border-b transition-colors hover:bg-muted/50 ${
                        index % 2 === 0 ? "" : "bg-gray-50"
                      }`}
                    >
                      <td className="p-2 align-middle font-medium">
                        {row.orden_de_compra || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row["pedido_cliente.tipo_tela"] || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        {row["pedido_cliente.color"] || "-"}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(row.total_factura || 0)}
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.totalMxp)}
                      </td>
                      <td className="p-2 align-middle">
                        {(calculatedData.tCambio * 100).toFixed(2)}%
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.gastosMxp)}
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.ddpTotalMxp)}
                      </td>
                      <td className="p-2 align-middle">
                        $MXN {formatCurrency(calculatedData.ddpMxpUnidad)}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(calculatedData.ddpUsdUnidad)}
                      </td>
                      <td className="p-2 align-middle">
                        ${formatCurrency(calculatedData.ddpUsdUnidadSIva)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.fecha_pedido)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.sale_origen)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.llega_a_Lazaro)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.llega_a_Manzanillo)}
                      </td>
                      <td className="p-2 align-middle">
                        {formatDate(row.llega_almacen_proveedor)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación mejorada con shadcn/ui */}
      {filteredData.length > 0 && (
        <div className="py-4 border-t border-gray-200 bg-white flex justify-center">
          <div className="flex items-center gap-4">
            {currentPage > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 py-2 rounded-md"
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Atrás
              </Button>
            )}

            <Pagination>
              <PaginationContent>
                {getPageNumbers().map((page, i) => (
                  <PaginationItem key={i}>
                    {page === "ellipsis1" || page === "ellipsis2" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(page as number);
                        }}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
              </PaginationContent>
            </Pagination>

            {currentPage < totalPages && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 py-2 rounded-md"
                onClick={() => goToPage(currentPage + 1)}
              >
                Siguiente
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
