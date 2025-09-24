import React from "react";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface YearFilterProps {
  selectedYear: number | null;
  onYearChange: (year: number | null) => void;
  availableYears: number[];
  className?: string;
}

export const YearFilter: React.FC<YearFilterProps> = ({
  selectedYear,
  onYearChange,
  availableYears,
  className = ""
}) => {
  return (
    <Select
      value={selectedYear?.toString() || "all"}
      onValueChange={(value) => onYearChange(value === "all" ? null : parseInt(value))}
    >
      <SelectTrigger className={`w-[160px] ${className}`}>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <SelectValue placeholder="Filtrar por año" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los años</SelectItem>
        {availableYears.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};