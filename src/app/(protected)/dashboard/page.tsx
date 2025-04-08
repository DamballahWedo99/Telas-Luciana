"use client";

import Dashboard from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
  const handleLogout = () => {
    console.log("Logout clicked - implementar AuthJS aquí más adelante");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard onLogout={handleLogout} />
    </div>
  );
}
