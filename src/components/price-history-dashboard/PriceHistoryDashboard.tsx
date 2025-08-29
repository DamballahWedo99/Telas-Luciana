import React, { useState, useEffect } from "react";
import { PriceHistoryCard } from "../orders-dashboard/PriceHistoryCard";
import { PriceAnalysisCard } from "../orders-dashboard/PriceAnalysisCard";
import { usePriceHistory } from "@/hooks/usePriceHistory";

// Mobile hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const mobileQuery = window.matchMedia("(max-width: 768px)");
      setIsMobile(mobileQuery.matches);
    };

    checkIsMobile();
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    mobileQuery.addEventListener("change", checkIsMobile);

    return () => {
      mobileQuery.removeEventListener("change", checkIsMobile);
    };
  }, []);

  return isMobile;
}

const PriceHistoryDashboard: React.FC = () => {
  const { data, loading } = usePriceHistory();
  const isMobile = useIsMobile();

  return (
    <div>
      <div className="space-y-6">
        <PriceHistoryCard />
        {!isMobile && (
          <PriceAnalysisCard 
            data={data}
            loading={loading}
            className="w-full"
          />
        )}
      </div>
    </div>
  );
};

export default PriceHistoryDashboard;