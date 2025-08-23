import React from "react";
import { PriceHistoryCard } from "../orders-dashboard/PriceHistoryCard";
import { PriceAnalysisCard } from "../orders-dashboard/PriceAnalysisCard";
import { usePriceHistory } from "@/hooks/usePriceHistory";

const PriceHistoryDashboard: React.FC = () => {
  const { data, loading } = usePriceHistory();

  return (
    <div>
      <div className="space-y-6">
        <PriceHistoryCard />
        <PriceAnalysisCard 
          data={data}
          loading={loading}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default PriceHistoryDashboard;