"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Save,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileText,
} from "lucide-react";
import { OrderCombobox } from "@/components/ui/order-combobox";
import { LoteCombobox } from "@/components/ui/lote-combobox";
import { TelaCombobox } from "@/components/ui/tela-combobox";
import { ColorCombobox } from "@/components/ui/color-combobox";
import { toast } from "sonner";
import { 
  Table, 
  TableBody, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { EditablePackingListRow } from "./EditablePackingListRow";
import { usePackingListBulkEditing } from "../../hooks/usePackingListBulkEditing";
import type {
  AvailableOrder,
  PackingListEditData,
} from "../../../types/types";

interface PackingListEditModalProps {
  open: boolean;
  onClose: () => void;
  onDataUpdated?: () => void;
}


export const PackingListEditModal: React.FC<PackingListEditModalProps> = ({
  open,
  onClose,
  onDataUpdated,
}) => {
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [selectedOC, setSelectedOC] = useState<string>("");
  const [orderData, setOrderData] = useState<PackingListEditData | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingRolls, setIsLoadingRolls] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [selectedLote, setSelectedLote] = useState<string>("all");
  const [selectedTela, setSelectedTela] = useState<string>("all");
  const [selectedColor, setSelectedColor] = useState<string>("all");

  // Use direct editing hook
  const {
    editingRolls,
    pendingChanges,
    hasPendingChanges,
    validation,
    isSaving,
    initializeRolls,
    updateRoll,
    deleteRoll,
    cancelEditingRoll,
    saveChanges,
    resetChanges,
    clearAllState,
    validateRoll,
  } = usePackingListBulkEditing({
    onDataUpdated: onDataUpdated ? async () => {
      try {
        await onDataUpdated();
      } catch (error) {
        throw error;
      }
    } : undefined,
  });

  // Get unique telas from current rolls
  const availableTelas = React.useMemo(() => {
    if (!orderData) return [];
    const uniqueTelas = [...new Set(orderData.rolls.map(roll => roll.tela))];
    return uniqueTelas.sort();
  }, [orderData]);

  // Get filtered lotes based on selected tela and color (for progressive selection)
  const filteredAvailableLotes = React.useMemo(() => {
    if (!orderData || selectedTela === "all" || selectedTela === "" || selectedColor === "all" || selectedColor === "") return [];
    const lotes = orderData.rolls
      .filter(roll => roll.tela === selectedTela && roll.color === selectedColor)
      .map(roll => roll.lote);
    return [...new Set(lotes)].sort();
  }, [orderData, selectedTela, selectedColor]);

  // KISS: Auto-select first lote when list changes
  React.useEffect(() => {
    if (filteredAvailableLotes.length > 0 && (selectedLote === "all" || !filteredAvailableLotes.includes(selectedLote))) {
      setSelectedLote(filteredAvailableLotes[0]);
    }
  }, [filteredAvailableLotes, selectedLote]);

  // Get roll counts per lote for filtered lotes (based on selected tela and color)
  const filteredLoteRollCounts = React.useMemo(() => {
    if (!orderData || selectedTela === "all" || selectedTela === "" || selectedColor === "all" || selectedColor === "") return {};
    const counts: Record<string, number> = {};
    
    orderData.rolls
      .filter(roll => roll.tela === selectedTela && roll.color === selectedColor)
      .forEach(roll => {
        counts[roll.lote] = (counts[roll.lote] || 0) + 1;
      });
    
    return counts;
  }, [orderData, selectedTela, selectedColor]);

  // Get lotes that have modifications based on current filters
  const lotesWithModifications = React.useMemo(() => {
    const modifiedLotes = new Set<string>();
    
    // Check editing rolls that have changes
    editingRolls
      .filter(roll => 
        roll.hasChanges && 
        (selectedTela === "all" || roll.tela === selectedTela) &&
        (selectedColor === "all" || roll.color === selectedColor)
      )
      .forEach(roll => {
        modifiedLotes.add(roll.lote);
      });
    
    // Check pending changes for additional lotes
    pendingChanges.forEach(change => {
      // For updates and deletes, use originalData lote
      if ((change.type === 'update' || change.type === 'delete') && change.originalData) {
        const lote = change.originalData.lote;
        const tela = change.originalData.tela;
        const color = change.originalData.color;
        
        if ((selectedTela === "all" || tela === selectedTela) &&
            (selectedColor === "all" || color === selectedColor)) {
          modifiedLotes.add(lote);
        }
      }
      
      // For adds, use the new data lote
      if (change.type === 'add' && change.data.lote) {
        const lote = change.data.lote as string;
        const tela = change.data.tela as string;
        const color = change.data.color as string;
        
        if ((selectedTela === "all" || tela === selectedTela) &&
            (selectedColor === "all" || color === selectedColor)) {
          modifiedLotes.add(lote);
        }
      }
    });
    
    return modifiedLotes;
  }, [editingRolls, pendingChanges, selectedTela, selectedColor]);

  // KISS: Get telas that have modifications
  const telasWithModifications = React.useMemo(() => {
    const modifiedTelas = new Set<string>();
    
    // Check editing rolls that have changes
    editingRolls.filter(roll => roll.hasChanges).forEach(roll => {
      modifiedTelas.add(roll.tela);
    });
    
    // Check pending changes
    pendingChanges.forEach(change => {
      if ((change.type === 'update' || change.type === 'delete') && change.originalData) {
        modifiedTelas.add(change.originalData.tela);
      }
      if (change.type === 'add' && change.data.tela) {
        modifiedTelas.add(change.data.tela as string);
      }
    });
    
    return modifiedTelas;
  }, [editingRolls, pendingChanges]);

  // KISS: Get colors that have modifications
  const colorsWithModifications = React.useMemo(() => {
    const modifiedColors = new Set<string>();
    
    // Check editing rolls that have changes
    editingRolls.filter(roll => roll.hasChanges).forEach(roll => {
      modifiedColors.add(roll.color);
    });
    
    // Check pending changes
    pendingChanges.forEach(change => {
      if ((change.type === 'update' || change.type === 'delete') && change.originalData) {
        modifiedColors.add(change.originalData.color);
      }
      if (change.type === 'add' && change.data.color) {
        modifiedColors.add(change.data.color as string);
      }
    });
    
    return modifiedColors;
  }, [editingRolls, pendingChanges]);

  // Get roll counts per tela
  const telaRollCounts = React.useMemo(() => {
    if (!orderData) return {};
    const counts: Record<string, number> = {};
    
    orderData.rolls.forEach(roll => {
      counts[roll.tela] = (counts[roll.tela] || 0) + 1;
    });
    
    return counts;
  }, [orderData]);

  // Get unique colors from current rolls (filtered by selected tela)
  const availableColors = React.useMemo(() => {
    if (!orderData || selectedTela === "all" || selectedTela === "") return [];
    const uniqueColors = [...new Set(orderData.rolls
      .filter(roll => roll.tela === selectedTela)
      .map(roll => roll.color)
    )];
    return uniqueColors.sort();
  }, [orderData, selectedTela]);

  // Get roll counts per color (filtered by selected tela)
  const colorRollCounts = React.useMemo(() => {
    if (!orderData || selectedTela === "all" || selectedTela === "") return {};
    const counts: Record<string, number> = {};
    
    orderData.rolls
      .filter(roll => roll.tela === selectedTela)
      .forEach(roll => {
        counts[roll.color] = (counts[roll.color] || 0) + 1;
      });
    
    return counts;
  }, [orderData, selectedTela]);

  // Filter rolls based on selected lote, tela, and color
  const filteredEditingRolls = React.useMemo(() => {
    let filtered = [...editingRolls];
    
    // Filter by tela
    if (selectedTela !== "all") {
      filtered = filtered.filter((roll) => roll.tela === selectedTela);
    }
    
    // Filter by color
    if (selectedColor !== "all") {
      filtered = filtered.filter((roll) => roll.color === selectedColor);
    }
    
    // Filter by lote
    if (selectedLote !== "all") {
      filtered = filtered.filter((roll) => roll.lote === selectedLote);
    }
    
    return filtered;
  }, [editingRolls, selectedTela, selectedColor, selectedLote]);

  // Handle order change and reset all dependent selections
  const handleOrderChange = (oc: string) => {
    setSelectedOC(oc);
    setSelectedTela("all");
    setSelectedColor("all");
    setSelectedLote("all");
  };

  // Handle tela change and reset dependent selections
  const handleTelaChange = (tela: string) => {
    setSelectedTela(tela);
    setSelectedColor("all"); // Reset color when tela changes
    setSelectedLote("all"); // Reset lote when tela changes
    
    // Auto-select color if only 1 unique color available
    if (tela !== "all" && tela !== "" && orderData) {
      const uniqueColors = [...new Set(orderData.rolls
        .filter(roll => roll.tela === tela)
        .map(roll => roll.color)
      )];
      
      if (uniqueColors.length === 1) {
        const selectedColor = uniqueColors[0];
        setSelectedColor(selectedColor);
        
        // Also auto-select lote if only one available for this tela+color combination
        const uniqueLotes = [...new Set(orderData.rolls
          .filter(roll => roll.tela === tela && roll.color === selectedColor)
          .map(roll => roll.lote)
        )];
        
        if (uniqueLotes.length === 1) {
          setSelectedLote(uniqueLotes[0]);
        }
      }
    }
  };

  // Handle color change and reset lote selection
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    setSelectedLote("all"); // Reset lote when color changes
    
    // Auto-select lote if only one available for this tela+color combination
    if (color !== "all" && color !== "" && selectedTela !== "all" && selectedTela !== "" && orderData) {
      const uniqueLotes = [...new Set(orderData.rolls
        .filter(roll => roll.tela === selectedTela && roll.color === color)
        .map(roll => roll.lote)
      )];
      
      if (uniqueLotes.length === 1) {
        setSelectedLote(uniqueLotes[0]);
      }
    }
  };

  const loadAvailableOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const response = await fetch("/api/packing-list/get-available-orders");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cargar órdenes disponibles");
      }

      const responseData = await response.json();
      
      // Handle both cached and non-cached responses
      const orders = responseData.data || responseData;
      setAvailableOrders(Array.isArray(orders) ? orders : []);
    } catch (error) {
      console.error("Error cargando órdenes:", error);
      toast.error(
        `Error al cargar órdenes disponibles: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      setAvailableOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const loadOrderRolls = React.useCallback(async (oc: string) => {
    setIsLoadingRolls(true);
    try {
      const response = await fetch(
        `/api/packing-list/get-order-rolls?oc=${encodeURIComponent(oc)}&refresh=true`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cargar rollos de la orden");
      }

      const data = await response.json();
      
      if (!data) {
        toast.warning(`No se encontraron rollos para la OC: ${oc}`);
        setOrderData(null);
        return;
      }

      setOrderData(data);
      initializeRolls(data.rolls);
    } catch (error) {
      console.error("Error cargando rollos:", error);
      toast.error(
        `Error al cargar rollos: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      setOrderData(null);
    } finally {
      setIsLoadingRolls(false);
    }
  }, [initializeRolls]);

  // Load available orders when modal opens
  useEffect(() => {
    if (open) {
      loadAvailableOrders();
    } else {
      // Reset state when modal closes
      setSelectedOC("");
      setSelectedTela("all");
      setSelectedColor("all");
      setSelectedLote("all");
      setOrderData(null);
      // Clear all hook state and tracking data
      clearAllState();
    }
  }, [open, clearAllState]);

  // Load order rolls when OC changes
  useEffect(() => {
    if (selectedOC) {
      loadOrderRolls(selectedOC);
    } else {
      setOrderData(null);
      setSelectedTela("all");
      setSelectedColor("all");
      setSelectedLote("all");
    }
  }, [selectedOC, loadOrderRolls]);

  // NOTE: Removed auto-reload effect that was causing unnecessary loading screens
  // The resetChanges function should handle restoring data instantly without reload

  // Note: We removed the reset on filter changes to preserve editing state
  // The editing state will only reset when order changes or modal closes


  const handleSaveChanges = async () => {
    const success = await saveChanges();
    
    if (success) {
      toast.success("Cambios guardados exitosamente");
      onClose();
    }
  };

  const handleClose = () => {
    if (hasPendingChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    resetChanges();
    setShowUnsavedChangesDialog(false);
    onClose();
  };



  const changedRollsCount = pendingChanges.length;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>Editar Packing List</span>
                {changedRollsCount > 0 && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    {changedRollsCount} cambio{changedRollsCount !== 1 ? "s" : ""} pendiente{changedRollsCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </DialogTitle>

            {/* Unified selectors row - responsive grid layout */}
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Order selector - takes more space on larger screens */}
                <div className="w-full lg:col-span-1">
                  <Label className="text-sm font-medium mb-1 block">Orden de Compra:</Label>
                  <OrderCombobox
                    orders={availableOrders}
                    value={selectedOC}
                    onValueChange={handleOrderChange}
                    placeholder="Seleccionar OC..."
                    className="w-full"
                    disabled={isLoadingOrders}
                  />
                </div>

                {/* Tela selector - show only when order is selected */}
                {selectedOC && orderData && availableTelas.length > 0 && (
                  <div className="w-full">
                    <Label className="text-sm font-medium mb-1 block">Tela:</Label>
                    <TelaCombobox
                      telas={availableTelas}
                      value={selectedTela}
                      onValueChange={handleTelaChange}
                      placeholder="Seleccionar tela..."
                      className="w-full"
                      rollCounts={telaRollCounts}
                      telasWithModifications={telasWithModifications}
                    />
                  </div>
                )}

                {/* Color selector - show only when order and tela are selected */}
                {selectedOC && selectedTela !== "all" && selectedTela !== "" && 
                 availableColors.length > 0 && (
                  <div className="w-full">
                    <Label className="text-sm font-medium mb-1 block">Color:</Label>
                    <ColorCombobox
                      colors={availableColors}
                      value={selectedColor}
                      onValueChange={handleColorChange}
                      placeholder="Seleccionar color..."
                      className="w-full"
                      rollCounts={colorRollCounts}
                      colorsWithModifications={colorsWithModifications}
                    />
                  </div>
                )}

                {/* Lote selector - show only when order, tela, and color are selected */}
                {selectedOC && selectedTela !== "all" && selectedTela !== "" && 
                 selectedColor !== "all" && selectedColor !== "" &&
                 filteredAvailableLotes.length > 0 && (
                  <div className="w-full">
                    <Label className="text-sm font-medium mb-1 block">Lote:</Label>
                    <LoteCombobox
                      lotes={filteredAvailableLotes}
                      value={selectedLote}
                      onValueChange={setSelectedLote}
                      placeholder="Seleccionar lote..."
                      className="w-full"
                      rollCounts={filteredLoteRollCounts}
                      lotesWithModifications={lotesWithModifications}
                    />
                  </div>
                )}
              </div>
              
              
              {/* Validation summary */}
              {validation.errors.length > 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {validation.errors.length} error{validation.errors.length !== 1 ? 'es' : ''} de validación. 
                    Revisa los campos marcados en rojo.
                  </AlertDescription>
                </Alert>
              )}

              {validation.warnings.length > 0 && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {validation.warnings.length} advertencia{validation.warnings.length !== 1 ? 's' : ''} encontrada{validation.warnings.length !== 1 ? 's' : ''}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col">
            {isLoadingOrders ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Cargando órdenes disponibles...</span>
                </div>
              </div>
            ) : isLoadingRolls ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Cargando rollos...</span>
                </div>
              </div>
            ) : !selectedOC ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Selecciona una orden de compra para comenzar</p>
                </div>
              </div>
            ) : !orderData ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No se encontraron rollos para esta orden de compra</p>
                </div>
              </div>
            ) : selectedTela === "all" || selectedTela === "" ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Selecciona una tela para ver los rollos disponibles</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {availableTelas.length} tipo{availableTelas.length !== 1 ? "s" : ""} de tela disponible{availableTelas.length !== 1 ? "s" : ""} en esta orden
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                
                <div className="border rounded-md">
                  <ScrollArea className="h-[50vh] max-h-[600px] min-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Rollo ID</TableHead>
                          <TableHead className="w-[100px]">Cantidad</TableHead>
                          <TableHead className="w-[80px]">Unidad</TableHead>
                          <TableHead className="w-[120px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEditingRolls.length === 0 ? (
                          <TableRow>
                            <td colSpan={4} className="text-center py-8 text-gray-500">
                              {selectedColor !== "all" || selectedLote !== "all" 
                                ? "No se encontraron rollos con los filtros seleccionados"
                                : "No hay rollos para mostrar"}
                            </td>
                          </TableRow>
                        ) : (
                        filteredEditingRolls.map((roll) => (
                            <EditablePackingListRow
                              key={roll.id}
                              roll={roll}
                              onUpdate={(data) => updateRoll(roll.id, data)}
                              onDelete={() => deleteRoll(roll.id)}
                              onCancel={() => cancelEditingRoll(roll.id)}
                              errors={validation.errors.filter(error => error.rollId === roll.id)}
                              validateRoll={validateRoll}
                            />
                          ))
                      )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {hasPendingChanges && (
                <Button
                  variant="outline"
                  onClick={resetChanges}
                  disabled={isSaving}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Descartar Cambios
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cerrar
              </Button>
              
              <Button
                onClick={handleSaveChanges}
                disabled={!hasPendingChanges || !validation.isValid || isSaving}
                className="min-w-[140px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes {changedRollsCount} cambio{changedRollsCount !== 1 ? "s" : ""} sin guardar. 
              ¿Estás seguro de que quieres cerrar sin guardar los cambios?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedChangesDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cerrar sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};