"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LogOutIcon,
  BarChart,
  LayoutDashboardIcon,
  FileText,
  NotebookTabs,
  Menu,
} from "lucide-react";

type ViewType = "inventory" | "orders";

interface NavbarProps {
  currentView: ViewType;
  isMajorAdmin: boolean;
  isLoggingOut: boolean;
  onViewChange: (view: ViewType) => void;
  onOpenFichasTecnicas: () => void;
  onOpenClientes: () => void;
  onLogout: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const mobileQuery = window.matchMedia("(max-width: 1024px)");
      setIsMobile(mobileQuery.matches);
    };

    if (typeof window !== "undefined") {
      checkIsMobile();
      window.addEventListener("resize", checkIsMobile);
      return () => window.removeEventListener("resize", checkIsMobile);
    }
  }, []);

  return isMobile;
}

export default function Navbar({
  currentView,
  isMajorAdmin,
  isLoggingOut,
  onViewChange,
  onOpenFichasTecnicas,
  onOpenClientes,
  onLogout,
}: NavbarProps) {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const getNavigationTitle = () => {
    switch (currentView) {
      case "inventory":
        return "Inventario";
      case "orders":
        return "Pedidos Históricos";
      default:
        return "Panel de Control";
    }
  };

  const handleMenuAction = (action: () => void) => {
    setIsSheetOpen(false);
    setTimeout(action, 100);
  };

  if (isMobile) {
    return (
      <div className="bg-gray-50 px-4">
        <div className="max-w-lg w-full mx-auto">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-lg font-bold">{getNavigationTitle()}</h1>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full">
                <SheetHeader>
                  <SheetTitle>Menú</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-8">
                  <Button
                    variant="ghost"
                    className="justify-start h-12 text-base"
                    onClick={() => handleMenuAction(onOpenFichasTecnicas)}
                  >
                    <FileText className="mr-3 h-5 w-5" />
                    Fichas Técnicas
                  </Button>

                  <Button
                    variant="ghost"
                    className="justify-start h-12 text-base"
                    onClick={() => handleMenuAction(onOpenClientes)}
                  >
                    <NotebookTabs className="mr-3 h-5 w-5" />
                    Directorio de Clientes
                  </Button>

                  {isMajorAdmin && (
                    <>
                      <div className="border-t my-3"></div>
                      <Button
                        variant="ghost"
                        className="justify-start h-12 text-base"
                        onClick={() =>
                          handleMenuAction(() => onViewChange("inventory"))
                        }
                      >
                        <LayoutDashboardIcon className="mr-3 h-5 w-5" />
                        Inventario
                      </Button>

                      <Button
                        variant="ghost"
                        className="justify-start h-12 text-base"
                        onClick={() =>
                          handleMenuAction(() => onViewChange("orders"))
                        }
                      >
                        <BarChart className="mr-3 h-5 w-5" />
                        Pedidos Históricos
                      </Button>
                    </>
                  )}

                  <div className="border-t my-3"></div>
                  <Button
                    variant="ghost"
                    className="justify-start h-12 text-base"
                    onClick={() => handleMenuAction(onLogout)}
                    disabled={isLoggingOut}
                  >
                    <LogOutIcon className="mr-3 h-5 w-5" />
                    {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center mb-3">
      <h1 className="text-2xl font-bold">{getNavigationTitle()}</h1>
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenFichasTecnicas}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Fichas Técnicas</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onOpenClientes}>
                <NotebookTabs className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Directorio de Clientes</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isMajorAdmin && (
          <Sheet>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                      <LayoutDashboardIcon className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Dashboards</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Seleccionar Dashboard</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-8">
                <Button
                  variant={currentView === "inventory" ? "default" : "ghost"}
                  className="justify-start h-12 text-base"
                  onClick={() => onViewChange("inventory")}
                >
                  <LayoutDashboardIcon className="mr-3 h-5 w-5" />
                  Dashboard de Inventario
                </Button>
                <Button
                  variant={currentView === "orders" ? "default" : "ghost"}
                  className="justify-start h-12 text-base"
                  onClick={() => onViewChange("orders")}
                >
                  <BarChart className="mr-3 h-5 w-5" />
                  Dashboard de Pedidos
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}

        <Button
          variant="outline"
          onClick={onLogout}
          className="flex items-center gap-2"
          disabled={isLoggingOut}
        >
          <LogOutIcon className="h-4 w-4" />
          {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
        </Button>
      </div>
    </div>
  );
}
