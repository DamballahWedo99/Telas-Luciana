"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/inventory-dashboard/InventoryDashboard";
import PedidosDashboard from "@/components/orders-dashboard/OrdersDashboard";
import LogisticsDashboard from "@/components/logistics-dashboard/LogisticsDashboard";
import PriceHistoryDashboard from "@/components/price-history-dashboard/PriceHistoryDashboard";
import FichasTecnicasDialog from "@/components/fichas-tecnicas/FichasTecnicasDialog";
import ClientesDialog from "@/components/directorio/ClientesDialog";
import ProveedoresDialog from "@/components/proveedores/ProveedoresDialog";
import Navbar from "@/components/NavBar";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useUserVerification } from "@/hooks/useUserVerification";

type ViewType = "inventory" | "orders" | "logistics" | "price-history";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentView, setCurrentView] = useState<ViewType>("inventory");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [openFichasTecnicas, setOpenFichasTecnicas] = useState(false);
  const [openClientes, setOpenClientes] = useState(false);
  const [openProveedores, setOpenProveedores] = useState(false);

  useUserVerification();

  const isMajorAdmin = session?.user?.role === "major_admin";
  const canAccessProveedores = session?.user?.role === "admin" || session?.user?.role === "major_admin";
  const canAccessPriceHistory = session?.user?.role === "admin" || session?.user?.role === "major_admin";

  useEffect(() => {
    console.log("📊 [Dashboard] Estado actual:", {
      status,
      hasSession: !!session,
      hasUserId: !!session?.user?.id,
    });

    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      console.log("🚫 [Dashboard] No autenticado, redirigiendo a login");
      router.replace("/login");
      return;
    }

    if (status === "authenticated" && !session?.user?.id) {
      console.log("⚠️ [Dashboard] Autenticado pero sin datos de usuario");

      const timeout = setTimeout(() => {
        console.log(
          "❌ [Dashboard] Timeout esperando datos de usuario, redirigiendo a login"
        );
        router.replace("/login");
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [status, session, router]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      sessionStorage.removeItem("lastLoginTime");
      sessionStorage.removeItem("loginAttempt");
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast.error("Error al cerrar sesión");
      setIsLoggingOut(false);
    }
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  const handleOpenFichasTecnicas = () => {
    setOpenFichasTecnicas(true);
  };

  const handleOpenClientes = () => {
    setOpenClientes(true);
  };

  const handleOpenProveedores = () => {
    setOpenProveedores(true);
  };


  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated" || !session?.user?.id) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-[100dvh] sm:min-h-screen bg-gray-50">
      <div className="container mx-auto p-2 sm:p-4">
        <div className="my-4">
          <Navbar
            currentView={currentView}
            isMajorAdmin={isMajorAdmin}
            canAccessProveedores={canAccessProveedores}
            canAccessPriceHistory={canAccessPriceHistory}
            isLoggingOut={isLoggingOut}
            onViewChange={handleViewChange}
            onOpenFichasTecnicas={handleOpenFichasTecnicas}
            onOpenClientes={handleOpenClientes}
            onOpenProveedores={handleOpenProveedores}
            onLogout={handleLogout}
          />
        </div>

        {currentView === "inventory" && <Dashboard />}

        {currentView === "orders" && isMajorAdmin && <PedidosDashboard />}

        {currentView === "logistics" && isMajorAdmin && <LogisticsDashboard />}

        {currentView === "price-history" && canAccessPriceHistory && <PriceHistoryDashboard />}

        <FichasTecnicasDialog
          open={openFichasTecnicas}
          setOpen={setOpenFichasTecnicas}
        />

        <ClientesDialog open={openClientes} setOpen={setOpenClientes} />

        <ProveedoresDialog
          open={openProveedores}
          setOpen={setOpenProveedores}
        />

      </div>
    </div>
  );
}
