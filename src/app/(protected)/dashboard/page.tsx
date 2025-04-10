"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Dashboard from "@/components/dashboard/Dashboard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useRouter } from "next/navigation";
import { useUserVerification } from "@/hooks/useUserVerification";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useUserVerification();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" && !isLoading) {
      router.push("/login");
    }
  }, [status, isLoading, router]);

  if (status === "loading" || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard />
    </div>
  );
}
