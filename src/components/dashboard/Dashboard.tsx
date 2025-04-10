"use client";

import React, { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import Papa from "papaparse";

import { LogOutIcon, HistoryIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { InventoryCard } from "@/components/dashboard/InventoryCard";
import { VisualizationsCard } from "@/components/dashboard/VisualizationsCard";
import { UserManagementCard } from "@/components/dashboard/UserManagementCard";
import { KeyMetricsSection } from "@/components/dashboard/KeyMetricsSection";
import { NewOrderDialog } from "@/components/dashboard/NewOrderDialog";
import { NewUserDialog } from "@/components/dashboard/NewUserDialog";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  InventoryItem,
  UnitType,
  User,
  ParsedCSVData,
} from "../../../types/types";
import { getInventarioCsv } from "@/lib/s3";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openNewOrder, setOpenNewOrder] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [openNewUser, setOpenNewUser] = useState(false);

  const { data: session } = useSession();

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    async function loadInventoryFromS3() {
      if (!session?.user) return;

      try {
        setIsLoadingInventory(true);
        toast.info("Cargando inventario desde S3...");

        const csvData = await getInventarioCsv();

        Papa.parse<ParsedCSVData>(csvData, {
          header: true,
          skipEmptyLines: true,
          complete: (results: Papa.ParseResult<ParsedCSVData>) => {
            try {
              const parsedData = results.data.map((item: ParsedCSVData) => {
                const costo = parseFloat(item.Costo || "0");
                const cantidad = parseFloat(item.Cantidad || "0");
                const total = costo * cantidad;

                return {
                  OC: item.OC || "",
                  Tela: item.Tela || "",
                  Color: item.Color || "",
                  Costo: costo,
                  Cantidad: cantidad,
                  Unidades: (item.Unidades || "") as UnitType,
                  Total: total,
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
              toast.success("Inventario cargado desde S3 exitosamente");
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
        toast.error("Error al cargar el inventario desde S3");
        setError(
          "Error al cargar el inventario desde S3. Verifica la conexión."
        );
      } finally {
        setIsLoadingInventory(false);
      }
    }

    loadInventoryFromS3();
  }, [session?.user]);

  const handleViewHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      toast.info("Cargando datos históricos...");
      setTimeout(() => {
        toast.success("Datos históricos cargados");
      }, 1000);
    }
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
      complete: (results: Papa.ParseResult<ParsedCSVData>) => {
        try {
          console.log("Raw CSV data:", results.data);
          const parsedData = results.data.map((item: ParsedCSVData) => {
            const costo = parseFloat(item.Costo || "0");
            const cantidad = parseFloat(item.Cantidad || "0");
            const total = costo * cantidad;

            console.log("Invoice field:", {
              raw: item["Factura Dragón Azteca"],
              alt1: item["Factura Dragon Azteca"],
              alt2: item.FacturaDragonAzteca,
            });

            return {
              OC: item.OC || "",
              Tela: item.Tela || "",
              Color: item.Color || "",
              Costo: costo,
              Cantidad: cantidad,
              Unidades: (item.Unidades || "") as UnitType,
              Total: total,
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

  return (
    <div className="container mx-auto p-4">
      <div className="my-4">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold">Panel de Control de Inventario</h1>
          <div className="flex items-center gap-2">
            {/* Solo mostrar el botón de historial si el usuario es administrador */}
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
                    <p>Ver datos históricos</p>
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

        {/* Mensaje de carga del inventario */}
        {isLoadingInventory && (
          <div className="mb-4">
            <LoadingScreen />
          </div>
        )}

        {/* Key Metrics Section - solo visible para administradores */}
        {isAdmin && <KeyMetricsSection inventory={inventory} />}

        {/* Inventory Card - visible para todos pero con restricciones */}
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
          setSuccess={setSuccess}
          handleFileUpload={handleFileUpload}
          openNewOrder={openNewOrder}
          setOpenNewOrder={setOpenNewOrder}
          isAdmin={isAdmin}
        />

        {/* Visualizations Card - solo visible para administradores */}
        {isAdmin && (
          <VisualizationsCard
            inventory={inventory}
            filters={{
              searchTerm,
              unitFilter,
              ocFilter,
              telaFilter,
              colorFilter,
            }}
          />
        )}

        {/* User Management Card - solo visible para administradores */}
        {isAdmin && (
          <UserManagementCard
            users={users}
            setUsers={setUsers}
            isLoadingUsers={isLoadingUsers}
            setOpenNewUser={setOpenNewUser}
          />
        )}

        {/* Dialogs */}
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
      </div>
    </div>
  );
};

export default Dashboard;
