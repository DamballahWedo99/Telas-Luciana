import React from "react";
import { LogisticsCard } from "./LogisticsCard";

const LogisticsDashboard: React.FC = () => {
  return (
    <div>
      <div className="space-y-6">
        <LogisticsCard />
      </div>
    </div>
  );
};

export default LogisticsDashboard;