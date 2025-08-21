"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Save,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { FabricCombobox } from "@/components/ui/fabric-combobox";
import { usePriceEditing } from "@/hooks/usePriceEditing";
import { ProviderTabContent } from "./ProviderTabContent";
import type {
  PriceHistoryResponse,
  MultiProviderTableData,
} from "@/types/price-history";

interface PriceEditModalProps {
  data: PriceHistoryResponse;
  multiProviderData: MultiProviderTableData | null;
  open: boolean;
  onClose: () => void;
  onDataUpdated: () => void;
}

const KNOWN_PROVIDERS = ['AD', 'RBK', 'LZ', 'CHANGXING', 'EM'];

export const PriceEditModal: React.FC<PriceEditModalProps> = ({
  data,
  multiProviderData,
  open,
  onClose,
  onDataUpdated,
}) => {
  const [selectedFabric, setSelectedFabric] = useState<string>(
    data.fabrics.length > 0 ? data.fabrics[0].fabricId : ''
  );
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);

  const {
    editingState,
    pendingChanges,
    hasPendingChanges,
    validation,
    isSaving,
    initializeFabricForEditing,
    addNewEntry,
    updateEntry,
    deleteEntry,
    cancelEdit,
    saveChanges,
    resetChanges,
    getEntriesForProvider,
    validateEntry
  } = usePriceEditing({
    data,
    multiProviderData,
    onDataUpdated,
  });

  // Initialize the first fabric when modal opens
  useEffect(() => {
    if (open && selectedFabric) {
      initializeFabricForEditing(selectedFabric);
    }
  }, [open, selectedFabric, initializeFabricForEditing]);

  // Get available providers for the selected fabric
  const availableProviders = useMemo(() => {
    if (!multiProviderData || !selectedFabric) return [];

    const fabricMatrix = multiProviderData.fabrics.find(f => f.fabricId === selectedFabric);
    if (!fabricMatrix) return [];

    // Get providers that have data or are in the known providers list
    const providersWithData = Object.keys(fabricMatrix.providers).filter(
      provider => fabricMatrix.providers[provider] !== null || KNOWN_PROVIDERS.includes(provider)
    );

    // Ensure all known providers are included
    const allProviders = new Set([...KNOWN_PROVIDERS, ...providersWithData]);
    
    return Array.from(allProviders).sort((a, b) => {
      const aIndex = KNOWN_PROVIDERS.indexOf(a);
      const bIndex = KNOWN_PROVIDERS.indexOf(b);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      } else if (aIndex !== -1) {
        return -1;
      } else if (bIndex !== -1) {
        return 1;
      } else {
        return a.localeCompare(b);
      }
    });
  }, [multiProviderData, selectedFabric]);

  // Set default active provider when fabric changes
  React.useEffect(() => {
    if (availableProviders.length > 0 && !activeProvider) {
      setActiveProvider(availableProviders[0]);
    }
  }, [availableProviders, activeProvider]);

  // Get selected fabric info
  const selectedFabricData = useMemo(() => {
    return data.fabrics.find(f => f.fabricId === selectedFabric);
  }, [data.fabrics, selectedFabric]);

  // Handle save and close
  const handleSaveAndClose = async () => {
    console.log('🎯 PriceEditModal.handleSaveAndClose called:', {
      selectedFabric,
      hasPendingChanges,
      pendingChangesCount: pendingChanges.length,
      validationIsValid: validation.isValid,
      timestamp: new Date().toISOString()
    });

    const success = await saveChanges();
    console.log('🎯 Save result:', success);
    
    if (success) {
      console.log('✅ Save successful, closing modal');
      onClose();
    } else {
      console.log('❌ Save failed, keeping modal open');
    }
  };

  // Handle close with confirmation if there are pending changes
  const handleClose = () => {
    if (hasPendingChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      onClose();
    }
  };

  // Handle closing modal with unsaved changes
  const handleConfirmClose = () => {
    resetChanges();
    setShowUnsavedChangesDialog(false);
    onClose();
  };

  // Handle canceling the close action
  const handleCancelClose = () => {
    setShowUnsavedChangesDialog(false);
  };

  // Count entries and changes by provider
  const getProviderStats = (provider: string) => {
    const entries = getEntriesForProvider(selectedFabric, provider);
    const changes = pendingChanges.filter(
      change => change.fabricId === selectedFabric && change.provider === provider
    );
    return {
      totalEntries: entries.length,
      hasChanges: changes.length > 0,
      newEntries: entries.filter(e => e.isNew).length,
      changedEntries: changes.filter(c => c.type === 'update').length,
      deletedEntries: changes.filter(c => c.type === 'delete').length,
    };
  };

  // Get validation errors for current provider
  const currentProviderErrors = validation.errors.filter(error => {
    const entry = editingState[selectedFabric]?.[activeProvider]?.find(e => e.id === error.entryId);
    return entry !== undefined;
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span>Editar Historial de Precios</span>
              {hasPendingChanges && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {pendingChanges.length} cambio{pendingChanges.length !== 1 ? 's' : ''} pendiente{pendingChanges.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </DialogTitle>

          {/* Fabric selector */}
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Tela:</span>
              <FabricCombobox
                fabrics={data.fabrics.map(fabric => ({
                  fabricId: fabric.fabricId,
                  fabricName: fabric.fabricName
                }))}
                value={selectedFabric}
                onValueChange={(fabricId) => {
                  setSelectedFabric(fabricId);
                  initializeFabricForEditing(fabricId);
                }}
                placeholder="Seleccionar tela"
                className="w-64"
              />
            </div>
            {selectedFabricData && (
              <div className="text-sm text-gray-600">
                {selectedFabricData.history.length} registro{selectedFabricData.history.length !== 1 ? 's' : ''} total{selectedFabricData.history.length !== 1 ? 'es' : ''}
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
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {availableProviders.length > 0 && selectedFabric ? (
            <Tabs value={activeProvider} onValueChange={setActiveProvider} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
                {availableProviders.slice(0, 5).map((provider) => {
                  const stats = getProviderStats(provider);
                  return (
                    <TabsTrigger 
                      key={provider} 
                      value={provider}
                      className="relative"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{provider}</span>
                        {stats.hasChanges && (
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        )}
                      </div>
                      {stats.totalEntries > 0 && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          {stats.totalEntries}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <div className="flex-1 overflow-hidden">
                {availableProviders.slice(0, 5).map((provider) => (
                  <TabsContent 
                    key={provider} 
                    value={provider}
                    className="h-full overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
                  >
                    <ProviderTabContent
                      provider={provider}
                      entries={getEntriesForProvider(selectedFabric, provider)}
                      onAddEntry={() => addNewEntry(selectedFabric, provider)}
                      onUpdateEntry={(entryId, data) => updateEntry(selectedFabric, provider, entryId, data)}
                      onDeleteEntry={(entryId) => deleteEntry(selectedFabric, provider, entryId)}
                      onCancelEdit={(entryId) => cancelEdit(selectedFabric, provider, entryId)}
                      validateEntry={validateEntry}
                      errors={currentProviderErrors}
                    />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No hay datos disponibles para esta tela</p>
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
              Cancelar
            </Button>
            
            <Button
              onClick={handleSaveAndClose}
              disabled={!hasPendingChanges || !validation.isValid || isSaving}
              className="min-w-[120px]"
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

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar. ¿Estás seguro de que quieres cerrar sin guardar los cambios?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClose}>
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
    </Dialog>
  );
};