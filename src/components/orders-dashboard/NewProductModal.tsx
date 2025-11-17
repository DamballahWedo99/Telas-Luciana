"use client";

import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Save,
  X,
  AlertTriangle,
  Loader2,
  Package,
} from "lucide-react";
import { useNewProduct } from "@/hooks/useNewProduct";
import { getCurrentDateString } from "@/lib/date-utils";

interface NewProductModalProps {
  open: boolean;
  onClose: () => void;
  onProductCreated: () => void;
  existingFabricIds?: string[];
}

const COMMON_UNITS = ['kg', 'mt'];
const KNOWN_PROVIDERS = ['AD', 'RBK', 'LZ', 'CHANGXING', 'EM', 'ASM', 'MH'];

export const NewProductModal: React.FC<NewProductModalProps> = ({
  open,
  onClose,
  onProductCreated,
  existingFabricIds = [],
}) => {
  const {
    state,
    isLoading,
    errors,
    updateField,
    createProduct,
    resetForm,
  } = useNewProduct({
    existingFabricIds,
    onSuccess: () => {
      onProductCreated();
      handleClose();
    },
  });

  // Get field-specific errors
  const getFieldErrors = (field: string) => {
    return errors.filter(error => error.field === field);
  };

  const generalErrors = getFieldErrors('general');
  const fabricNameErrors = getFieldErrors('fabricName');
  const providerErrors = getFieldErrors('provider');
  const dateErrors = getFieldErrors('date');
  const quantityErrors = getFieldErrors('quantity');
  const unitErrors = getFieldErrors('unit');

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct();
  };

  // Handle modal close
  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      onClose();
      
      // Force immediate cleanup when manually closing
      setTimeout(() => {
        // Remove any lingering overlays
        const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
        const contents = document.querySelectorAll('[data-radix-dialog-content]');

        overlays.forEach((overlay) => {
          overlay.remove();
        });

        contents.forEach((content) => {
          if (!content.closest('[data-state="open"]')) {
            content.remove();
          }
        });
        
        // Force body scroll restoration
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      }, 100);
    }
  };

  // Cleanup effect when modal closes
  useEffect(() => {
    if (!open) {
      
      // Delay cleanup to ensure modal animation completes
      const cleanup = setTimeout(() => {
        // Remove any lingering overlays
        const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
        const contents = document.querySelectorAll('[data-radix-dialog-content]');

        overlays.forEach((overlay) => {
          overlay.remove();
        });

        contents.forEach((content) => {
          if (!content.closest('[data-state="open"]')) {
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

  // Handle provider selection (both predefined and custom)
  const handleProviderChange = (value: string) => {
    if (value === 'custom') {
      // Clear the provider field to let user type custom value
      updateField('provider', '');
      return;
    }
    updateField('provider', value);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen && !isLoading) {
          handleClose();
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-[500px] z-[9999]"
        onPointerDownOutside={(e) => {
          if (isLoading) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading) {
            e.preventDefault();
          }
        }}
        style={{ zIndex: 9999 }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Package className="mr-2 h-5 w-5" />
            Agregar Nuevo Producto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Errors */}
          {generalErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {generalErrors.map((error, index) => (
                  <div key={index}>{error.message}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="fabricName">Nombre del Producto *</Label>
            <Input
              id="fabricName"
              type="text"
              value={state.fabricName}
              onChange={(e) => updateField('fabricName', e.target.value)}
              className={fabricNameErrors.length > 0 ? 'border-red-500' : ''}
              placeholder="Ej: TELA ALGODÓN PREMIUM"
              disabled={isLoading}
              autoFocus
            />
            {fabricNameErrors.map((error, index) => (
              <div key={index} className="text-sm text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Proveedor *</Label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <Select
                  value={KNOWN_PROVIDERS.includes(state.provider) ? state.provider : 'custom'}
                  onValueChange={handleProviderChange}
                  disabled={isLoading}
                >
                  <SelectTrigger className={providerErrors.length > 0 ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Seleccionar proveedor..." />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    {KNOWN_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Otro (escribir)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(!KNOWN_PROVIDERS.includes(state.provider) || !state.provider) && (
                <div className="flex-1">
                  <Input
                    type="text"
                    value={state.provider}
                    onChange={(e) => updateField('provider', e.target.value)}
                    className={providerErrors.length > 0 ? 'border-red-500' : ''}
                    placeholder="Escribir proveedor..."
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>
            {providerErrors.map((error, index) => (
              <div key={index} className="text-sm text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>

          {/* Date and Price Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Fecha *</Label>
              <Input
                id="date"
                type="date"
                value={state.date}
                onChange={(e) => updateField('date', e.target.value)}
                className={dateErrors.length > 0 ? 'border-red-500' : ''}
                max={getCurrentDateString()}
                disabled={isLoading}
              />
              {dateErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {error.message}
                </div>
              ))}
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Precio Inicial *</Label>
              <Input
                id="quantity"
                type="number"
                value={state.quantity || ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                  updateField('quantity', value);
                }}
                className={quantityErrors.length > 0 ? 'border-red-500' : ''}
                placeholder="0.00"
                step="0.01"
                min="0"
                max="999999"
                disabled={isLoading}
              />
              {quantityErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {error.message}
                </div>
              ))}
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-2">
            <Label htmlFor="unit">Unidad *</Label>
            <Select
              value={state.unit}
              onValueChange={(value) => updateField('unit', value)}
              disabled={isLoading}
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
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Crear Producto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};