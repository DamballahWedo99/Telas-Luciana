"use client";

import React, { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FabricCombobox } from "@/components/ui/fabric-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  UserPlus,
  X,
  AlertTriangle,
  Calendar,
  DollarSign,
  Package,
  Shirt
} from "lucide-react";
import type { FabricPriceHistory } from "@/types/price-history";
import { useNewProvider } from "@/hooks/useNewProvider";
import { getCurrentDateString, formatDateForDisplay } from "@/lib/date-utils";

interface NewProviderModalProps {
  open: boolean;
  onClose: () => void;
  onProviderAdded: () => void;
  availableFabrics: FabricPriceHistory[];
}

const COMMON_UNITS = ['kg', 'mt'];

export const NewProviderModal: React.FC<NewProviderModalProps> = ({
  open,
  onClose,
  onProviderAdded,
  availableFabrics,
}) => {
  const {
    state,
    isLoading,
    errors,
    updateField,
    addProvider,
    resetForm,
  } = useNewProvider({
    onSuccess: () => {
      console.log('🎉 NewProviderModal: onSuccess called');
      console.log('📊 Modal state:', { isLoading, open });
      
      // FORCE immediate modal close to prevent overlay conflicts
      console.log('🚪 NewProviderModal: Force closing modal IMMEDIATELY');
      onClose();
      
      // Add delay for parent refresh to prevent data conflicts
      setTimeout(() => {
        console.log('🔄 NewProviderModal: Triggering parent refresh');
        onProviderAdded();
      }, 150);
    },
    availableFabrics,
  });

  // Handle modal close
  const handleClose = () => {
    console.log('🔒 NewProviderModal: handleClose called, isLoading:', isLoading);
    
    // Prevent closing if operation is in progress
    if (isLoading) {
      console.log('⚠️ NewProviderModal: Prevented close during loading');
      return;
    }
    
    console.log('✅ NewProviderModal: Proceeding with close');
    resetForm();
    onClose();
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent multiple submissions
    await addProvider();
  };

  // Get field-specific errors
  const getFieldErrors = (field: string) => {
    return errors.filter(error => error.field === field);
  };

  const fabricErrors = getFieldErrors('fabricId');
  const providerErrors = getFieldErrors('provider');
  const dateErrors = getFieldErrors('date');
  const quantityErrors = getFieldErrors('quantity');
  const unitErrors = getFieldErrors('unit');
  const generalErrors = getFieldErrors('general');

  // Check if form is valid
  const isFormValid = 
    state.fabricId && 
    state.provider && 
    state.date && 
    state.quantity > 0 && 
    state.unit && 
    errors.length === 0;

  // Transform availableFabrics to FabricCombobox format
  const fabricOptions = useMemo(() => {
    return availableFabrics.map(fabric => ({
      fabricId: fabric.fabricId,
      fabricName: fabric.fabricName
    }));
  }, [availableFabrics]);

  // Get selected fabric info for preview
  const selectedFabric = availableFabrics.find(f => f.fabricId === state.fabricId);

  // Cleanup effect when modal closes
  useEffect(() => {
    if (!open) {
      console.log('🧹 NewProviderModal: Modal closed, cleaning up DOM');
      
      // Delay cleanup to ensure modal animation completes
      const cleanup = setTimeout(() => {
        // Remove any lingering overlays
        const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
        const contents = document.querySelectorAll('[data-radix-dialog-content]');
        
        overlays.forEach((overlay, index) => {
          console.log(`🗑️ Removing overlay ${index}:`, overlay);
          overlay.remove();
        });
        
        contents.forEach((content, index) => {
          if (!content.closest('[data-state="open"]')) {
            console.log(`🗑️ Removing closed content ${index}:`, content);
            content.remove();
          }
        });
        
        // Force body scroll restoration
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      }, 200);
      
      return () => clearTimeout(cleanup);
    }
  }, [open]);

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        console.log('🔄 Dialog onOpenChange:', { isOpen, isLoading });
        if (!isOpen && !isLoading) {
          handleClose();
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-[600px] z-[9999]" 
        aria-describedby="new-provider-description"
        onPointerDownOutside={(e) => {
          if (isLoading) {
            console.log('🚫 Prevented outside click during loading');
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading) {
            console.log('🚫 Prevented escape key during loading');
            e.preventDefault();
          }
        }}
        style={{ zIndex: 9999 }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserPlus className="h-5 w-5 mr-2 text-black" />
            Agregar Nuevo Proveedor
          </DialogTitle>
          <DialogDescription id="new-provider-description">
            Agregar precio de un nuevo proveedor para una tela existente
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General errors */}
          {generalErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {generalErrors[0].message}
              </AlertDescription>
            </Alert>
          )}

          {/* Fabric Selection */}
          <div className="space-y-2">
            <Label htmlFor="fabric" className="flex items-center">
              <Shirt className="h-4 w-4 mr-1" />
              Tela
            </Label>
            <FabricCombobox
              fabrics={fabricOptions}
              value={state.fabricId}
              onValueChange={(value) => updateField('fabricId', value)}
              placeholder="Seleccionar tela..."
              className={fabricErrors.length > 0 ? 'border-red-500' : ''}
              disabled={isLoading}
            />
            {fabricErrors.map((error, index) => (
              <div key={index} className="text-sm text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Provider Field */}
            <div className="space-y-2">
              <Label htmlFor="provider" className="flex items-center">
                <UserPlus className="h-4 w-4 mr-1" />
                Proveedor
              </Label>
              <Input
                id="provider"
                type="text"
                value={state.provider}
                onChange={(e) => updateField('provider', e.target.value)}
                placeholder="Nombre del proveedor"
                className={providerErrors.length > 0 ? 'border-red-500' : ''}
                required
              />
              {providerErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {error.message}
                </div>
              ))}
            </div>

            {/* Date Field */}
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Fecha
              </Label>
              <Input
                id="date"
                type="date"
                value={state.date}
                onChange={(e) => updateField('date', e.target.value)}
                max={getCurrentDateString()}
                className={dateErrors.length > 0 ? 'border-red-500' : ''}
                required
              />
              {dateErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {error.message}
                </div>
              ))}
            </div>

            {/* Price Field */}
            <div className="space-y-2">
              <Label htmlFor="quantity" className="flex items-center">
                <DollarSign className="h-4 w-4 mr-1" />
                Precio
              </Label>
              <Input
                id="quantity"
                type="number"
                value={state.quantity === 0 ? '' : state.quantity}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                  updateField('quantity', value);
                }}
                placeholder="0.00"
                step="0.01"
                min="0"
                className={quantityErrors.length > 0 ? 'border-red-500' : ''}
                required
              />
              {quantityErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {error.message}
                </div>
              ))}
            </div>
          </div>

          {/* Unit Field */}
          <div className="space-y-2">
            <Label htmlFor="unit" className="flex items-center">
              <Package className="h-4 w-4 mr-1" />
              Unidad
            </Label>
            <Select
              value={state.unit}
              onValueChange={(value) => updateField('unit', value)}
            >
              <SelectTrigger className={unitErrors.length > 0 ? 'border-red-500' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                {COMMON_UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unitErrors.map((error, index) => (
              <div key={index} className="text-sm text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>

          {/* Preview */}
          {selectedFabric && state.provider && state.date && state.quantity > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-800 mb-1 font-medium">Vista previa:</div>
              <div className="text-sm text-gray-700">
                <div><strong>Tela:</strong> {selectedFabric.fabricName} ({selectedFabric.fabricId})</div>
                <div><strong>Proveedor:</strong> {state.provider}</div>
                <div><strong>Fecha:</strong> {formatDateForDisplay(state.date)}</div>
                <div><strong>Precio:</strong> {' '}
                  {new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                  }).format(state.quantity)} / {state.unit}
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            
            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="bg-black hover:bg-gray-800"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isLoading ? 'Agregando...' : 'Agregar Proveedor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};