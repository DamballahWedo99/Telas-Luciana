"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import Dashboard from "@/components/inventory-dashboard/InventoryDashboard";
import PedidosDashboard from "@/components/orders-dashboard/OrdersDashboard";
import FichasTecnicasDialog from "@/components/fichas-tecnicas/FichasTecnicasDialog";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useUserVerification } from "@/hooks/useUserVerification";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LogOutIcon,
  BarChart,
  LayoutDashboardIcon,
  FileText,
} from "lucide-react";

type ViewType = "inventory" | "orders";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>("inventory");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [openFichasTecnicas, setOpenFichasTecnicas] = useState(false);

  useUserVerification();

  const isMajorAdmin = session?.user?.role === "major_admin";

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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

  const handleViewPedidosDashboard = () => {
    setCurrentView("orders");
  };

  const handleBackFromPedidosDashboard = () => {
    setCurrentView("inventory");
  };

  const handleOpenFichasTecnicas = () => {
    setOpenFichasTecnicas(true);
  };

  if (status === "loading" || isLoading) {
    return <LoadingScreen />;
  }

  const getNavigationTitle = () => {
    switch (currentView) {
      case "inventory":
        return "Panel de Control de Inventario";
      case "orders":
        return "Dashboard de Pedidos Históricos";
      default:
        return "Panel de Control";
    }
  };

  return (
    <div className="min-h-[100dvh] sm:min-h-screen bg-gray-50">
      <div className="container mx-auto p-2 sm:p-4">
        <div className="my-4 hidden md:block">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-2xl font-bold">{getNavigationTitle()}</h1>
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleOpenFichasTecnicas}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Fichas Técnicas</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {isMajorAdmin && (
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={
                            currentView === "inventory" ? "default" : "outline"
                          }
                          size="icon"
                          onClick={handleBackFromPedidosDashboard}
                          className={
                            currentView === "inventory"
                              ? "bg-blue-600 hover:bg-blue-700"
                              : ""
                          }
                        >
                          <LayoutDashboardIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Dashboard de Inventario</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={
                            currentView === "orders" ? "default" : "outline"
                          }
                          size="icon"
                          onClick={handleViewPedidosDashboard}
                          className={
                            currentView === "orders"
                              ? "bg-blue-600 hover:bg-blue-700"
                              : ""
                          }
                        >
                          <BarChart className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Dashboard de Pedidos</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
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
        </div>

        {currentView === "inventory" && <Dashboard />}

        {currentView === "orders" && <PedidosDashboard />}

        <FichasTecnicasDialog
          open={openFichasTecnicas}
          setOpen={setOpenFichasTecnicas}
        />
      </div>
    </div>
  );
}
