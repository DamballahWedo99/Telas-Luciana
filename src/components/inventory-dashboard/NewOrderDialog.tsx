import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { InventoryItem, NewOrderForm, UnitType } from "../../../types/types";

const availableColors = [
  "Amarillo Neon",
  "Bandera",
  "Beige",
  "Blanco",
  "Gris",
  "Guinda",
  "Marino",
  "Marino Medio",
  "Militar",
  "Morado",
  "Negro",
  "Naranja",
  "Oro",
  "Oxford",
  "Petróleo",
  "Plúmbago",
  "Rojo",
  "Rey",
  "Rosa Pastel",
  "Turquesa",
  "Verde Agua",
];

interface NewOrderDialogProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
}

export const NewOrderDialog: React.FC<NewOrderDialogProps> = ({
  open,
  setOpen,
  setInventory,
  setSuccess,
}) => {
  const [newOrder, setNewOrder] = useState<NewOrderForm>({
    OC: "",
    Tela: "",
    Color: "",
    Costo: 0,
    Cantidad: 0,
    Unidades: "MTS",
    Importacion: "DA",
    FacturaDragonAzteca: "",
    Ubicacion: "",
  });

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleCloseNewOrder = () => {
    setOpen(false);
    setNewOrder({
      OC: "",
      Tela: "",
      Color: "",
      Costo: 0,
      Cantidad: 0,
      Unidades: "MTS",
      Importacion: "DA",
      FacturaDragonAzteca: "",
      Ubicacion: "",
    });
  };

  const handleNewOrderChange = (
    field: keyof NewOrderForm,
    value: string | number
  ) => {
    setNewOrder((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveNewOrder = () => {
    const total = newOrder.Costo * newOrder.Cantidad;
    const newItem: InventoryItem = {
      ...newOrder,
      Total: total,
    };

    setInventory((prev) => [...prev, newItem]);
    setSuccess("Nueva orden agregada exitosamente");
    handleCloseNewOrder();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva Orden de Compra</DialogTitle>
          <DialogDescription>
            Completa los campos para agregar una nueva orden al inventario.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="oc">Orden de Compra</Label>
              <Input
                id="oc"
                value={newOrder.OC}
                onChange={(e) => handleNewOrderChange("OC", e.target.value)}
                placeholder="OC"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tela">Tela</Label>
              <Input
                id="tela"
                value={newOrder.Tela}
                onChange={(e) => handleNewOrderChange("Tela", e.target.value)}
                placeholder="Nombre de la tela"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              {/* Reemplazamos el Input por un Select */}
              <Select
                value={newOrder.Color}
                onValueChange={(value) => handleNewOrderChange("Color", value)}
              >
                <SelectTrigger id="color">
                  <SelectValue placeholder="Seleccionar color" />
                </SelectTrigger>
                <SelectContent>
                  {availableColors.map((color) => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="costo">Costo</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  $
                </span>
                <Input
                  id="costo"
                  type="number"
                  value={newOrder.Costo}
                  onChange={(e) =>
                    handleNewOrderChange(
                      "Costo",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                type="number"
                value={newOrder.Cantidad}
                onChange={(e) =>
                  handleNewOrderChange(
                    "Cantidad",
                    parseFloat(e.target.value) || 0
                  )
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidades">Unidades</Label>
              <Select
                value={newOrder.Unidades}
                onValueChange={(value) =>
                  handleNewOrderChange("Unidades", value as UnitType)
                }
              >
                <SelectTrigger id="unidades">
                  <SelectValue placeholder="Seleccionar unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTS">MTS</SelectItem>
                  <SelectItem value="KGS">KGS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="importacion">Importación</Label>
              <Select
                value={newOrder.Importacion}
                onValueChange={(value) =>
                  handleNewOrderChange("Importacion", value as "DA" | "HOY")
                }
              >
                <SelectTrigger id="importacion">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DA">DA</SelectItem>
                  <SelectItem value="HOY">HOY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                value={newOrder.Ubicacion}
                onChange={(e) =>
                  handleNewOrderChange("Ubicacion", e.target.value)
                }
                placeholder="Ubicación"
              />
            </div>
          </div>

          <div className="bg-muted p-3 rounded-md">
            <p className="font-semibold">
              Total: ${formatNumber(newOrder.Costo * newOrder.Cantidad)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleCloseNewOrder}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveNewOrder}
            disabled={
              !newOrder.OC ||
              !newOrder.Tela ||
              !newOrder.Color ||
              !newOrder.Costo ||
              !newOrder.Cantidad ||
              !newOrder.Unidades ||
              !newOrder.Ubicacion
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
