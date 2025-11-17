import React, { useState, useEffect } from "react";
import { CalendarIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const months = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

interface InventoryHistoryDialogProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onLoadInventory: (year: string, month: string) => Promise<void>;
}

export const InventoryHistoryDialog: React.FC<InventoryHistoryDialogProps> = ({
  open,
  setOpen,
  onLoadInventory,
}) => {
  const [year, setYear] = useState<string>("2025");
  const [month, setMonth] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    const loadAvailableYears = async () => {
      try {
        setAvailableYears(["2025"]);

        setYear("2025");
      } catch {
        toast.error("Error al cargar los años disponibles");
      }
    };

    if (open) {
      loadAvailableYears();
    }
  }, [open]);

  useEffect(() => {
    if (!year) {
      setAvailableMonths([]);
      return;
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear().toString();
    const currentMonth = currentDate.getMonth() + 1;

    let availableMonthValues: string[] = [];

    if (year === currentYear) {
      availableMonthValues = months
        .filter((m) => parseInt(m.value) <= currentMonth)
        .map((m) => m.value);
    } else if (parseInt(year) < parseInt(currentYear)) {
      availableMonthValues = months.map((m) => m.value);
    } else {
      availableMonthValues = [];
    }

    setAvailableMonths(availableMonthValues);

    if (
      year === currentYear &&
      availableMonthValues.includes(currentMonth.toString().padStart(2, "0"))
    ) {
      setMonth(currentMonth.toString().padStart(2, "0"));
    } else if (availableMonthValues.length > 0) {
      setMonth(availableMonthValues[availableMonthValues.length - 1]);
    } else {
      setMonth("");
    }
  }, [year]);

  const handleLoadInventory = async () => {
    if (!year || !month) {
      toast.error("Selecciona un año y un mes");
      return;
    }

    try {
      setIsLoading(true);
      await onLoadInventory(year, month);
      setOpen(false);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  function getMonthName(monthNumber: string): string {
    const month = months.find((m) => m.value === monthNumber);
    return month ? month.label : "";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cargar Inventario Histórico</DialogTitle>
          <DialogDescription>
            Selecciona el año y mes del inventario que deseas cargar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="year">Año</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="year">
                <SelectValue placeholder="Selecciona un año" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((yearOption) => (
                  <SelectItem key={yearOption} value={yearOption}>
                    {yearOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="month">Mes</Label>
            <Select
              value={month}
              onValueChange={setMonth}
              disabled={!availableMonths.length}
            >
              <SelectTrigger id="month">
                <SelectValue placeholder="Selecciona un mes" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem
                    key={m.value}
                    value={m.value}
                    disabled={!availableMonths.includes(m.value)}
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {year && month && (
            <div className="bg-muted p-3 rounded-md">
              <p className="font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Seleccionado: {getMonthName(month)} {year}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleLoadInventory}
            disabled={!year || !month || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <CheckIcon className="mr-2 h-4 w-4" />
                Cargar Inventario
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
