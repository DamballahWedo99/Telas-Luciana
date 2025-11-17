"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DownloadIcon,
  FilterIcon,
  SearchIcon,
  XCircleIcon,
  PackageIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

import { formatNumber } from "@/lib/utils";
import { InventoryItem, FilterOptions, UnitType } from "../../../types/types";

interface LockScreenProps {
  inventory: InventoryItem[];
  filters: FilterOptions;
  isAdmin: boolean;
}

const LockScreen: React.FC<LockScreenProps> = ({ inventory, isAdmin }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState<UnitType | "all">("all");
  const [ocFilter, setOcFilter] = useState<string>("all");
  const [telaFilter, setTelaFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [ubicacionFilter, setUbicacionFilter] = useState<string>("all");

  const uniqueOCs = useMemo(
    () =>
      Array.from(
        new Set(
          inventory.filter((item) => item.Cantidad > 0).map((item) => item.OC)
        )
      )
        .filter(Boolean)
        .sort(),
    [inventory]
  );

  const uniqueTelas = useMemo(
    () =>
      Array.from(
        new Set(
          inventory.filter((item) => item.Cantidad > 0).map((item) => item.Tela)
        )
      )
        .filter(Boolean)
        .sort(),
    [inventory]
  );

  const uniqueColors = useMemo(
    () =>
      Array.from(
        new Set(
          inventory
            .filter((item) => item.Cantidad > 0)
            .map((item) => item.Color)
        )
      )
        .filter(Boolean)
        .sort(),
    [inventory]
  );

  const uniqueUbicaciones = useMemo(
    () =>
      Array.from(
        new Set(
          inventory
            .filter((item) => item.Cantidad > 0)
            .map((item) => item.Ubicacion)
        )
      )
        .filter(Boolean)
        .sort(),
    [inventory]
  );

  const resetAllFilters = () => {
    setSearchTerm("");
    setUnitFilter("all");
    setOcFilter("all");
    setTelaFilter("all");
    setColorFilter("all");
    setUbicacionFilter("all");
  };

  const isFilterActive = useMemo(() => {
    return (
      searchTerm !== "" ||
      unitFilter !== "all" ||
      ocFilter !== "all" ||
      telaFilter !== "all" ||
      colorFilter !== "all" ||
      ubicacionFilter !== "all"
    );
  }, [
    searchTerm,
    unitFilter,
    ocFilter,
    telaFilter,
    colorFilter,
    ubicacionFilter,
  ]);

  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const hasQuantity = item.Cantidad > 0;

        const matchesSearch = isAdmin
          ? item.OC.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
            item.Tela.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.trim().toLowerCase())
          : item.Tela.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
            item.Color.toLowerCase().includes(searchTerm.trim().toLowerCase());

        const matchesUnit =
          unitFilter === "all" || item.Unidades === unitFilter;

        const matchesOC = isAdmin
          ? ocFilter === "all" || item.OC === ocFilter
          : true;

        const matchesTela = telaFilter === "all" || item.Tela === telaFilter;

        const matchesColor =
          colorFilter === "all" || item.Color === colorFilter;

        const matchesUbicacion =
          ubicacionFilter === "all" || item.Ubicacion === ubicacionFilter;

        return (
          hasQuantity &&
          matchesSearch &&
          matchesUnit &&
          matchesOC &&
          matchesTela &&
          matchesColor &&
          matchesUbicacion
        );
      }),
    [
      inventory,
      searchTerm,
      unitFilter,
      ocFilter,
      telaFilter,
      colorFilter,
      ubicacionFilter,
      isAdmin,
    ]
  );

  const totalCantidad = useMemo(() => {
    return filteredInventory.reduce((total, item) => total + item.Cantidad, 0);
  }, [filteredInventory]);

  const totalCosto = useMemo(() => {
    return filteredInventory.reduce((total, item) => total + item.Total, 0);
  }, [filteredInventory]);

  const telaSummary = useMemo(() => {
    const summary = new Map<
      string,
      {
        cantidad: number;
        items: number;
        unidades: string;
        ubicaciones: Set<string>;
      }
    >();

    filteredInventory.forEach((item) => {
      const key = item.Tela;
      if (summary.has(key)) {
        const existing = summary.get(key)!;
        existing.cantidad += item.Cantidad;
        existing.items += 1;
        existing.ubicaciones.add(item.Ubicacion || "Sin ubicación");
      } else {
        summary.set(key, {
          cantidad: item.Cantidad,
          items: 1,
          unidades: item.Unidades,
          ubicaciones: new Set([item.Ubicacion || "Sin ubicación"]),
        });
      }
    });

    return Array.from(summary.entries())
      .map(([tela, data]) => ({
        tela,
        cantidad: data.cantidad,
        items: data.items,
        unidades: data.unidades,
        ubicaciones: Array.from(data.ubicaciones).join(", "),
      }))
      .sort((a, b) => a.tela.localeCompare(b.tela));
  }, [filteredInventory]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const title = isAdmin ? "Inventario Completo" : "Inventario Resumido";
      doc.setFontSize(18);
      doc.text(title, 14, 22);

      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(
        now.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}/${now.getFullYear()}`;
      doc.setFontSize(11);
      doc.text(`Fecha: ${dateStr}`, 14, 30);

      let columns = [];
      let rows = [];

      if (isAdmin) {
        columns = [
          { header: "OC", dataKey: "OC" },
          { header: "Tela", dataKey: "Tela" },
          { header: "Color", dataKey: "Color" },
          { header: "Costo", dataKey: "Costo" },
          { header: "Cantidad", dataKey: "Cantidad" },
          { header: "Unidades", dataKey: "Unidades" },
          { header: "Total", dataKey: "Total" },
          { header: "Ubicación", dataKey: "Ubicacion" },
          { header: "Importación", dataKey: "Importacion" },
        ];

        rows = filteredInventory.map((item) => [
          item.OC,
          item.Tela,
          item.Color,
          `${formatNumber(item.Costo)}`,
          formatNumber(item.Cantidad),
          item.Unidades,
          `${formatNumber(item.Total)}`,
          item.Ubicacion || "-",
          item.Importacion,
        ]);

        rows.push([
          "TOTAL",
          "",
          "",
          "",
          formatNumber(totalCantidad),
          "",
          `${formatNumber(totalCosto)}`,
          "",
          "",
        ]);
      } else {
        columns = [
          { header: "Tela", dataKey: "Tela" },
          { header: "Color", dataKey: "Color" },
          { header: "Cantidad", dataKey: "Cantidad" },
          { header: "Unidades", dataKey: "Unidades" },
          { header: "Ubicación", dataKey: "Ubicacion" },
        ];

        rows = filteredInventory.map((item) => [
          item.Tela,
          item.Color,
          formatNumber(item.Cantidad),
          item.Unidades,
          item.Ubicacion || "-",
        ]);

        rows.push(["TOTAL", "", formatNumber(totalCantidad), "", ""]);
      }

      autoTable(doc, {
        startY: 40,
        head: [columns.map((col) => col.header)],
        body: rows,
        theme: "striped",
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        footStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        didDrawCell: (data) => {
          if (data.section === "body" && data.row.index === rows.length - 1) {
            doc.setFillColor(240, 240, 240);
            doc.setFont("helvetica", "bold");
          }
        },
      });

      if (isFilterActive) {
        let yPos = 180;
        doc.setFontSize(10);
        doc.text("Filtros aplicados:", 14, yPos);
        yPos += 5;

        if (searchTerm !== "") {
          doc.text(`Búsqueda: "${searchTerm}"`, 20, yPos);
          yPos += 5;
        }
        if (unitFilter !== "all") {
          doc.text(`Unidades: ${unitFilter}`, 20, yPos);
          yPos += 5;
        }
        if (isAdmin && ocFilter !== "all") {
          doc.text(`OC: ${ocFilter}`, 20, yPos);
          yPos += 5;
        }
        if (telaFilter !== "all") {
          doc.text(`Tela: ${telaFilter}`, 20, yPos);
          yPos += 5;
        }
        if (colorFilter !== "all") {
          doc.text(`Color: ${colorFilter}`, 20, yPos);
          yPos += 5;
        }
        if (ubicacionFilter !== "all") {
          doc.text(`Ubicación: ${ubicacionFilter}`, 20, yPos);
        }
      }

      const filename = isAdmin ? "inventario_completo" : "inventario_resumido";
      const dateForFilename = `${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;

      doc.save(`${filename}_${dateForFilename}.pdf`);

      toast.success("PDF exportado exitosamente");
    } catch {
      toast.error("Ocurrió un error al exportar a PDF");
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-gray-50 p-4">
      <div className="max-w-lg w-full mx-auto space-y-4">
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center">
                <FilterIcon className="mr-2 h-5 w-5 text-primary" />
                Filtrar Inventario
              </CardTitle>
              {isFilterActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllFilters}
                  className="h-8 px-2"
                >
                  <XCircleIcon className="h-4 w-4 mr-1" />
                  <span className="text-xs">Limpiar</span>
                </Button>
              )}
            </div>
            <CardDescription>
              Filtra el inventario antes de descargar
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="search" className="text-xs">
                Buscar
              </Label>
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder={
                    isAdmin
                      ? "Buscar por OC, Tela, o Color"
                      : "Buscar por Tela o Color"
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="unitFilter" className="text-xs">
                  Unidades
                </Label>
                <Select
                  value={unitFilter}
                  onValueChange={(value) =>
                    setUnitFilter(value as UnitType | "all")
                  }
                >
                  <SelectTrigger id="unitFilter" className="w-full">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="MTS">MTS</SelectItem>
                    <SelectItem value="KGS">KGS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <div className="space-y-1">
                  <Label htmlFor="ocFilter" className="text-xs">
                    OC
                  </Label>
                  <Select value={ocFilter} onValueChange={setOcFilter}>
                    <SelectTrigger id="ocFilter" className="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueOCs.map((oc) => (
                        <SelectItem key={oc} value={oc}>
                          {oc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="telaFilter" className="text-xs">
                  Tela
                </Label>
                <Select value={telaFilter} onValueChange={setTelaFilter}>
                  <SelectTrigger id="telaFilter" className="w-full">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueTelas.map((tela) => (
                      <SelectItem key={tela} value={tela}>
                        {tela}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="colorFilter" className="text-xs">
                  Color
                </Label>
                <Select value={colorFilter} onValueChange={setColorFilter}>
                  <SelectTrigger id="colorFilter" className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueColors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ubicacionFilter" className="text-xs">
                  Ubicación
                </Label>
                <Select
                  value={ubicacionFilter}
                  onValueChange={setUbicacionFilter}
                >
                  <SelectTrigger id="ubicacionFilter" className="w-full">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Mérida">Mérida</SelectItem>
                    <SelectItem value="CEDIS CONPARTEX">CEDIS CONPARTEX</SelectItem>
                    {uniqueUbicaciones.map(
                      (ubicacion) =>
                        ubicacion !== "Mérida" &&
                        ubicacion !== "Edo Mex" &&
                        ubicacion !== "CEDIS CONPARTEX" && (
                          <SelectItem key={ubicacion} value={ubicacion}>
                            {ubicacion}
                          </SelectItem>
                        )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {ocFilter !== "all" && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  OC: {ocFilter}
                </span>
              )}
              {telaFilter !== "all" && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  Tela: {telaFilter}
                </span>
              )}
              {colorFilter !== "all" && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                  Color: {colorFilter}
                </span>
              )}
              {ubicacionFilter !== "all" && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                  Ubicación: {ubicacionFilter}
                </span>
              )}
              {unitFilter !== "all" && (
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                  Unidades: {unitFilter}
                </span>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pt-2 pb-4">
            <Button
              variant="default"
              onClick={handleExportPDF}
              className="w-full flex items-center justify-center"
              size="lg"
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Descargar PDF ({filteredInventory.length}{" "}
              {filteredInventory.length === 1 ? "ítem" : "ítems"})
            </Button>
          </CardFooter>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <PackageIcon className="mr-2 h-5 w-5 text-primary" />
              Resumen por Tela
            </CardTitle>
            <CardDescription>
              {telaSummary.length} tipos de tela encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {telaSummary.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {telaSummary.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.tela}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {item.items} producto{item.items !== 1 ? "s" : ""} •{" "}
                        {item.ubicaciones}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">
                        {formatNumber(item.cantidad)} {item.unidades}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <PackageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">
                  No hay telas que coincidan con los filtros
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LockScreen;
