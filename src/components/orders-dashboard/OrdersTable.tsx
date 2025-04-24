import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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

  // Calcular valores para cada fila
  const calculateRowData = (row: PedidoData) => {
    // Extraer valores base (con valores predeterminados para evitar cálculos con undefined/null)
    const totalFactura = row.total_factura || 0;
    const tipoDeCambio = row.tipo_de_cambio || 18.5; // Valor predeterminado si es 0
    const totalGastos = row.total_gastos || 0;
    const mFactura = row.m_factura || 1; // Evitar división por cero

    // PASO 1: Calcular total_mxp (conversión pesos)
    const totalMxp = totalFactura * (tipoDeCambio > 0 ? tipoDeCambio : 18.5);

    // PASO 2: Calcular tasa de cambio (proporción del gasto total)
    // Si no hay múltiples elementos con la misma orden, podemos usar 1 (100%)
    const tCambio = 0.17; // Asumimos que esta fila representa el 100% de la orden

    // PASO 3: Calcular gastos en pesos
    const gastosMxp = tCambio * totalGastos;

    // PASO 4: Calcular DDP total en pesos
    const ddpTotalMxp = gastosMxp + totalMxp;

    // PASO 5: Calcular DDP por unidad en pesos
    const ddpMxpUnidad = mFactura > 0 ? ddpTotalMxp / mFactura : 0;

    // PASO 6: Calcular DDP por unidad en dólares
    const ddpUsdUnidad = tipoDeCambio > 0 ? ddpMxpUnidad / tipoDeCambio : 0;

    // PASO 7: Calcular DDP por unidad en dólares sin IVA
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
      {/* Contenedor principal con scroll horizontal */}
      <div className="rounded-md border overflow-hidden">
        <ScrollArea className="w-full overflow-auto" orientation="horizontal">
          <div className="min-w-[2500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[880px] font-medium">
                    Orden de Compra
                  </TableHead>
                  <TableHead className="w-[880px] font-medium">
                    Tipo de Tela
                  </TableHead>
                  <TableHead className="w-[220px] font-medium">Color</TableHead>
                  <TableHead className="w-[240px] font-medium">
                    Total Factura (USD)
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    Total MXP
                  </TableHead>
                  <TableHead className="w-[200px] font-medium">
                    T. Cambio
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    Gastos MXP
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    DDP Total MXP
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    DDP MXP/Unidad
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    DDP USD/Unidad
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    DDP USD/Unidad S/IVA
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    Fecha Pedido
                  </TableHead>
                  <TableHead className="w-[240px] font-medium">
                    Sale Origen
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    Llega a Lázaro
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    Llega a Manzanillo
                  </TableHead>
                  <TableHead className="w-[340px] font-medium">
                    Llega Almacén
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="max-h-[600px] overflow-y-auto">
                {!hasData ? (
                  <TableRow>
                    <TableCell colSpan={16} className="h-24 text-center">
                      No se encontraron resultados para los filtros
                      seleccionados
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((row, index) => {
                    // Calcular valores para cada celda
                    const calculatedData = calculateRowData(row);

                    return (
                      <TableRow
                        key={index}
                        className={index % 2 === 0 ? "" : "bg-gray-50"}
                      >
                        <TableCell className="w-[180px] font-medium">
                          {row.orden_de_compra || "-"}
                        </TableCell>
                        <TableCell className="w-[180px]">
                          {row["pedido_cliente.tipo_tela"] || "-"}
                        </TableCell>
                        <TableCell className="w-[120px]">
                          {row["pedido_cliente.color"] || "-"}
                        </TableCell>
                        <TableCell className="w-[140px]">
                          ${formatCurrency(row.total_factura || 0)}
                        </TableCell>
                        <TableCell className="w-[140px]">
                          $MXN {formatCurrency(calculatedData.totalMxp)}
                        </TableCell>
                        <TableCell className="w-[100px]">
                          {(calculatedData.tCambio * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="w-[140px]">
                          $MXN {formatCurrency(calculatedData.gastosMxp)}
                        </TableCell>
                        <TableCell className="w-[140px]">
                          $MXN {formatCurrency(calculatedData.ddpTotalMxp)}
                        </TableCell>
                        <TableCell className="w-[140px]">
                          $MXN {formatCurrency(calculatedData.ddpMxpUnidad)}
                        </TableCell>
                        <TableCell className="w-[140px]">
                          ${formatCurrency(calculatedData.ddpUsdUnidad)}
                        </TableCell>
                        <TableCell className="w-[160px]">
                          ${formatCurrency(calculatedData.ddpUsdUnidadSIva)}
                        </TableCell>
                        <TableCell className="w-[120px]">
                          {formatDate(row.fecha_pedido)}
                        </TableCell>
                        <TableCell className="w-[120px]">
                          {formatDate(row.sale_origen)}
                        </TableCell>
                        <TableCell className="w-[120px]">
                          {formatDate(row.llega_a_Lazaro)}
                        </TableCell>
                        <TableCell className="w-[140px]">
                          {formatDate(row.llega_a_Manzanillo)}
                        </TableCell>
                        <TableCell className="w-[140px]">
                          {formatDate(row.llega_almacen_proveedor)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" className="h-3" />
        </ScrollArea>
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
                <ChevronLeftIcon className="h-4 w-4" />
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
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
