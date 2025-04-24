"use client";

import React, { useState, useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import Papa from "papaparse";

import { LogOutIcon, HistoryIcon, BarChart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { InventoryCard } from "@/components/inventory-dashboard/InventoryCard";
import { VisualizationsCard } from "@/components/inventory-dashboard/VisualizationsCard";
import { UserManagementCard } from "@/components/inventory-dashboard/UserManagementCard";
import { KeyMetricsSection } from "@/components/inventory-dashboard/KeyMetricsSection";
import { NewOrderDialog } from "@/components/inventory-dashboard/NewOrderDialog";
import { NewUserDialog } from "@/components/inventory-dashboard/NewUserDialog";
import { InventoryHistoryDialog } from "@/components/inventory-dashboard/InventoryHistoryDialog";
import PedidosDashboard from "@/components/orders-dashboard/OrdersDashboard";
import {
  InventoryItem,
  UnitType,
  User,
  ParsedCSVData,
  FilterOptions,
} from "../../../types/types";
import { getInventarioCsv } from "@/lib/s3";
import { parseNumericValue, mapCsvFields, normalizeCsvData } from "@/lib/utils";

const toastsShown = {
  loading: false,
  success: false,
};

interface DashboardProps {
  onLogout?: () => void;
}

const Dashboard: React.FC<DashboardProps> = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState<UnitType | "all">("all");
  const [ocFilter, setOcFilter] = useState<string>("all");
  const [telaFilter, setTelaFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [ubicacionFilter, setUbicacionFilter] = useState<string>("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openNewOrder, setOpenNewOrder] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [showPedidosDashboard, setShowPedidosDashboard] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [openNewUser, setOpenNewUser] = useState(false);

  const inventoryLoadedRef = useRef(false);

  const { data: session } = useSession();

  const isAdmin =
    session?.user?.role === "admin" || session?.user?.role === "major_admin";
  const isMajorAdmin = session?.user?.role === "major_admin";

  const filters: FilterOptions = {
    searchTerm,
    unitFilter,
    ocFilter,
    telaFilter,
    colorFilter,
    ubicacionFilter,
  };

  function getMonthName(monthNumber: string): string {
    const months = [
      { value: "01", label: "Enero" },
      { value: "02", label: "Febrero" },
      { value: "03", label: "Marzo" },
      { value: "04", label: "Abril" },
      { value: "05", label: "Mayo" },
      { value: "06", label: "Junio" },
      { value: "07", label: "Julio" },
      { value: "08", label: "Agosto" },
      { value: "09", label: "Septiembre" },
      { value: "10", label: "Octubre" },
      { value: "11", label: "Noviembre" },
      { value: "12", label: "Diciembre" },
    ];
    const month = months.find((m) => m.value === monthNumber);
    return month ? month.label : "";
  }

  const showToastOnce = (type: "loading" | "success", message: string) => {
    if (!toastsShown[type]) {
      if (type === "loading") {
        toast.info(message);
      } else {
        toast.success(message);
      }
      toastsShown[type] = true;

      setTimeout(() => {
        toastsShown[type] = false;
      }, 10000);
    }
  };

  useEffect(() => {
    async function loadInventoryFromS3() {
      if (!session?.user || inventoryLoadedRef.current) return;

      try {
        setIsLoadingInventory(true);
        showToastOnce("loading", "Cargando inventario desde S3...");

        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");

        const csvData = await getInventarioCsv(currentYear, currentMonth);

        Papa.parse<ParsedCSVData>(csvData, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          delimiter: ",",
          delimitersToGuess: [",", ";", "\t", "|"],

          transform: (value, field) => {
            if (field === "Costo" || field === "Cantidad") {
              return value
                .replace(/\s/g, "")
                .replace(/\$/g, "")
                .replace(/,/g, ".");
            }
            return value;
          },

          complete: (results: Papa.ParseResult<ParsedCSVData>) => {
            try {
              console.log("Columnas detectadas:", results.meta.fields);
              console.log("Datos de muestra:", results.data.slice(0, 3));

              const fieldMap = mapCsvFields(results.meta.fields || []);
              console.log("Mapeo de campos:", fieldMap);

              let dataToProcess = results.data;
              if (
                Object.keys(fieldMap).length > 0 &&
                Object.keys(fieldMap).length !== results.meta.fields?.length
              ) {
                dataToProcess = normalizeCsvData(results.data, fieldMap);
              }

              const parsedData = dataToProcess.map((item: any) => {
                const costo = parseNumericValue(item.Costo);
                const cantidad = parseNumericValue(item.Cantidad);
                const total = costo * cantidad;

                if (isNaN(costo)) {
                  console.warn("Valor de costo inválido:", item.Costo);
                }
                if (isNaN(cantidad)) {
                  console.warn("Valor de cantidad inválido:", item.Cantidad);
                }

                return {
                  OC: item.OC || "",
                  Tela: item.Tela || "",
                  Color: item.Color || "",
                  Costo: costo,
                  Cantidad: cantidad,
                  Unidades: (item.Unidades || "") as UnitType,
                  Total: total,
                  Ubicacion: item.Ubicacion || "",
                  Importacion: (item.Importacion || item.Importación || "") as
                    | "DA"
                    | "HOY",
                  FacturaDragonAzteca:
                    item["Factura Dragón Azteca"] ||
                    item["Factura Dragon Azteca"] ||
                    item.FacturaDragonAzteca ||
                    "",
                } as InventoryItem;
              });

              setInventory(parsedData);
              showToastOnce(
                "success",
                "Inventario cargado desde S3 exitosamente"
              );
              inventoryLoadedRef.current = true;
            } catch (err) {
              console.error("Error parsing CSV from S3:", err);
              toast.error(
                "Error al procesar el archivo CSV de S3. Verifique el formato."
              );
              setError("Error al procesar el archivo CSV de S3.");
            }
          },
          error: (error: Error) => {
            console.error("CSV parsing error:", error);
            toast.error("Error al leer el archivo CSV de S3");
            setError("Error al leer el archivo CSV de S3.");
          },
        });
      } catch (error) {
        console.error("Error loading inventory from S3:", error);
        toast.error(
          "Error al cargar el inventario desde S3. Verifica la conexión."
        );
        setError(
          "Error al cargar el inventario desde S3. Verifica la conexión."
        );
      } finally {
        setIsLoadingInventory(false);
      }
    }

    loadInventoryFromS3();

    return () => {};
  }, [session?.user]);

  const handleLoadHistoricalInventory = async (year: string, month: string) => {
    try {
      setIsLoadingInventory(true);
      toast.info(`Cargando inventario de ${getMonthName(month)} ${year}...`);

      const csvData = await getInventarioCsv(year, month);

      Papa.parse<ParsedCSVData>(csvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimiter: ",",
        delimitersToGuess: [",", ";", "\t", "|"],

        transform: (value, field) => {
          if (field === "Costo" || field === "Cantidad") {
            return value
              .replace(/\s/g, "")
              .replace(/\$/g, "")
              .replace(/,/g, ".");
          }
          return value;
        },

        complete: (results: Papa.ParseResult<ParsedCSVData>) => {
          try {
            console.log(
              `Columnas en CSV de ${month}/${year}:`,
              results.meta.fields
            );
            console.log("Datos de muestra:", results.data.slice(0, 3));

            const fieldMap = mapCsvFields(results.meta.fields || []);
            console.log("Mapeo de campos:", fieldMap);

            let dataToProcess = results.data;
            if (
              Object.keys(fieldMap).length > 0 &&
              Object.keys(fieldMap).length !== results.meta.fields?.length
            ) {
              dataToProcess = normalizeCsvData(results.data, fieldMap);
            }

            const parsedData = dataToProcess.map((item: any) => {
              const costo = parseNumericValue(item.Costo);
              const cantidad = parseNumericValue(item.Cantidad);
              const total = costo * cantidad;

              if (isNaN(costo)) {
                console.warn("Valor de costo inválido:", item.Costo);
              }
              if (isNaN(cantidad)) {
                console.warn("Valor de cantidad inválido:", item.Cantidad);
              }

              return {
                OC: item.OC || "",
                Tela: item.Tela || "",
                Color: item.Color || "",
                Costo: costo,
                Cantidad: cantidad,
                Unidades: (item.Unidades || "") as UnitType,
                Total: total,
                Ubicacion: item.Ubicacion || "",
                Importacion: (item.Importacion || item.Importación || "") as
                  | "DA"
                  | "HOY",
                FacturaDragonAzteca:
                  item["Factura Dragón Azteca"] ||
                  item["Factura Dragon Azteca"] ||
                  item.FacturaDragonAzteca ||
                  "",
              } as InventoryItem;
            });

            setInventory(parsedData);
            toast.success(
              `Inventario de ${getMonthName(
                month
              )} ${year} cargado exitosamente`
            );
            setShowHistory(true);
          } catch (err) {
            console.error("Error parsing historical CSV:", err);
            toast.error(
              "Error al procesar el archivo CSV histórico. Verifique el formato."
            );
          }
        },
        error: (error: Error) => {
          console.error("Historical CSV parsing error:", error);
          toast.error("Error al leer el archivo CSV histórico");
        },
      });
    } catch (error) {
      console.error("Error loading historical inventory:", error);
      toast.error(
        `Error al cargar el inventario de ${getMonthName(
          month
        )} ${year}. Es posible que no exista.`
      );
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const handleViewHistory = () => {
    setOpenHistoryDialog(true);
  };

  const handleViewPedidosDashboard = () => {
    setShowPedidosDashboard(true);
  };

  const handleBackFromPedidosDashboard = () => {
    setShowPedidosDashboard(false);
  };

  useEffect(() => {
    async function loadUsers() {
      if (!isAdmin) {
        setIsLoadingUsers(false);
        return;
      }

      try {
        setIsLoadingUsers(true);
        const response = await fetch("/api/users");

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al cargar usuarios");
        }

        const data = await response.json();
        setUsers(data.users);
      } catch (error) {
        console.error("Error cargando usuarios:", error);
        toast.error("No se pudieron cargar los usuarios");
      } finally {
        setIsLoadingUsers(false);
      }
    }

    loadUsers();
  }, [isAdmin]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast.error("Error al cerrar sesión");
      setIsLoggingOut(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<ParsedCSVData>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: ",",
      delimitersToGuess: [",", ";", "\t", "|"],

      transform: (value, field) => {
        if (field === "Costo" || field === "Cantidad") {
          return value.replace(/\s/g, "").replace(/\$/g, "").replace(/,/g, ".");
        }
        return value;
      },

      complete: (results: Papa.ParseResult<ParsedCSVData>) => {
        try {
          console.log("Columnas detectadas:", results.meta.fields);
          console.log("Datos de muestra:", results.data.slice(0, 3));

          const fieldMap = mapCsvFields(results.meta.fields || []);
          console.log("Mapeo de campos:", fieldMap);

          let dataToProcess = results.data;
          if (
            Object.keys(fieldMap).length > 0 &&
            Object.keys(fieldMap).length !== results.meta.fields?.length
          ) {
            dataToProcess = normalizeCsvData(results.data, fieldMap);
          }

          const parsedData = dataToProcess.map((item: any) => {
            const costo = parseNumericValue(item.Costo);
            const cantidad = parseNumericValue(item.Cantidad);
            const total = costo * cantidad;

            if (isNaN(costo)) {
              console.warn("Valor de costo inválido:", item.Costo);
            }
            if (isNaN(cantidad)) {
              console.warn("Valor de cantidad inválido:", item.Cantidad);
            }

            return {
              OC: item.OC || "",
              Tela: item.Tela || "",
              Color: item.Color || "",
              Costo: costo,
              Cantidad: cantidad,
              Unidades: (item.Unidades || "") as UnitType,
              Total: total,
              Ubicacion: item.Ubicacion || "",
              Importacion: (item.Importacion || item.Importación || "") as
                | "DA"
                | "HOY",
              FacturaDragonAzteca:
                item["Factura Dragón Azteca"] ||
                item["Factura Dragon Azteca"] ||
                item.FacturaDragonAzteca ||
                "",
            } as InventoryItem;
          });

          setInventory(parsedData);
          toast.success("Archivo cargado exitosamente");
        } catch (err) {
          console.error("Error parsing CSV:", err);
          toast.error(
            "Error al procesar el archivo CSV. Verifique el formato."
          );
        }
      },
      error: (error: Error) => {
        console.error("CSV parsing error:", error);
        toast.error("Error al leer el archivo CSV");
      },
    });
  };

  // Si estamos mostrando el dashboard de pedidos, renderizamos solo ese componente
  if (showPedidosDashboard) {
    return <PedidosDashboard onBack={handleBackFromPedidosDashboard} />;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="my-4">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold">Panel de Control de Inventario</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleViewHistory}
                      className="mr-2"
                    >
                      <HistoryIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cargar datos históricos</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {isMajorAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleViewPedidosDashboard}
                      className="mr-2"
                    >
                      <BarChart className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ver pedidos históricos</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

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

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isAdmin && (
          <KeyMetricsSection inventory={inventory} filters={filters} />
        )}

        <InventoryCard
          inventory={inventory}
          setInventory={setInventory}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          unitFilter={unitFilter}
          setUnitFilter={setUnitFilter}
          ocFilter={ocFilter}
          setOcFilter={setOcFilter}
          telaFilter={telaFilter}
          setTelaFilter={setTelaFilter}
          colorFilter={colorFilter}
          setColorFilter={setColorFilter}
          ubicacionFilter={ubicacionFilter}
          setUbicacionFilter={setUbicacionFilter}
          setSuccess={setSuccess}
          handleFileUpload={handleFileUpload}
          openNewOrder={openNewOrder}
          setOpenNewOrder={setOpenNewOrder}
          isAdmin={isAdmin}
          isLoading={isLoadingInventory}
        />

        {isAdmin && (
          <VisualizationsCard inventory={inventory} filters={filters} />
        )}

        {isAdmin && (
          <UserManagementCard
            users={users}
            setUsers={setUsers}
            isLoadingUsers={isLoadingUsers}
            setOpenNewUser={setOpenNewUser}
          />
        )}

        <NewOrderDialog
          open={openNewOrder}
          setOpen={setOpenNewOrder}
          inventory={inventory}
          setInventory={setInventory}
          setSuccess={setSuccess}
        />

        {isAdmin && (
          <NewUserDialog
            open={openNewUser}
            setOpen={setOpenNewUser}
            users={users}
            setUsers={setUsers}
            session={session}
          />
        )}

        {isMajorAdmin && (
          <InventoryHistoryDialog
            open={openHistoryDialog}
            setOpen={setOpenHistoryDialog}
            onLoadInventory={handleLoadHistoricalInventory}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
