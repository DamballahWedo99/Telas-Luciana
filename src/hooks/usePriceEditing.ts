import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { getCurrentDateString, parseDateSafely } from '@/lib/date-utils';
import type {
  PriceHistoryResponse,
  MultiProviderTableData,
  EditablePriceEntry,
  PendingChange,
  PriceEditingState,
  PriceEditValidation,
  ValidationError,
  PriceHistoryEntry,
  BulkPriceUpdateRequest
} from '@/types/price-history';

interface UsePriceEditingOptions {
  data: PriceHistoryResponse | null;
  multiProviderData: MultiProviderTableData | null;
  onDataUpdated?: () => void;
}

interface UsePriceEditingReturn {
  editingState: PriceEditingState;
  pendingChanges: PendingChange[];
  hasPendingChanges: boolean;
  validation: PriceEditValidation;
  isSaving: boolean;
  
  // Actions
  initializeFabricForEditing: (fabricId: string) => void;
  addNewEntry: (fabricId: string, provider: string) => void;
  updateEntry: (fabricId: string, provider: string, entryId: string, data: Partial<PriceHistoryEntry>) => void;
  deleteEntry: (fabricId: string, provider: string, entryId: string) => void;
  cancelEdit: (fabricId: string, provider: string, entryId: string) => void;
  saveChanges: () => Promise<boolean>;
  resetChanges: () => void;
  
  // Utilities
  getEntriesForProvider: (fabricId: string, provider: string) => EditablePriceEntry[];
  validateEntry: (entry: Partial<PriceHistoryEntry>) => ValidationError[];
}

export function usePriceEditing(options: UsePriceEditingOptions): UsePriceEditingReturn {
  const { data, multiProviderData, onDataUpdated } = options;
  
  const [editingState, setEditingState] = useState<PriceEditingState>({});
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize editing state from data - only create entries for fabrics being edited
  const initializeEditingState = useCallback(() => {
    // Don't auto-initialize all data - only initialize when specifically editing a fabric
    setEditingState({});
  }, []);

  // Initialize state when data changes
  useMemo(() => {
    initializeEditingState();
  }, [initializeEditingState]);

  // Initialize a specific fabric for editing
  const initializeFabricForEditing = useCallback((fabricId: string) => {
    if (!data || !multiProviderData) return;

    // Check if this fabric is already initialized
    if (editingState[fabricId]) return;

    const newFabricState: { [provider: string]: EditablePriceEntry[] } = {};

    // Find the fabric in multiProviderData
    const fabricMatrix = multiProviderData.fabrics.find(f => f.fabricId === fabricId);
    if (fabricMatrix) {
      Object.keys(fabricMatrix.providers).forEach(provider => {
        const providerData = fabricMatrix.providers[provider];
        if (providerData?.allEntries) {
          // Convert entries to editable format
          newFabricState[provider] = providerData.allEntries.map((entry, index) => ({
            ...entry,
            id: `${fabricId}-${provider}-${index}-${entry.date}`,
            isEditing: false,
            isNew: false,
            originalData: { ...entry }
          }));
        } else {
          newFabricState[provider] = [];
        }
      });
    }

    setEditingState(prev => ({
      ...prev,
      [fabricId]: newFabricState
    }));
  }, [data, multiProviderData, editingState]);

  // Generate unique ID for new entries
  const generateEntryId = useCallback((fabricId: string, provider: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${fabricId}-${provider}-new-${timestamp}-${random}`;
  }, []);

  // Validate individual entry
  const validateEntry = useCallback((entry: Partial<PriceHistoryEntry>): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Validate date
    if (!entry.date) {
      errors.push({ field: 'date', message: 'La fecha es requerida' });
    } else {
      try {
        const date = parseDateSafely(entry.date);
        if (isNaN(date.getTime())) {
          errors.push({ field: 'date', message: 'Formato de fecha inválido' });
        } else if (date > new Date()) {
          errors.push({ field: 'date', message: 'La fecha no puede ser futura' });
        }
      } catch {
        errors.push({ field: 'date', message: 'Formato de fecha inválido' });
      }
    }

    // Validate provider
    if (!entry.provider || entry.provider.trim() === '') {
      errors.push({ field: 'provider', message: 'El proveedor es requerido' });
    }

    // Validate quantity/price
    if (entry.quantity === undefined || entry.quantity === null) {
      errors.push({ field: 'quantity', message: 'El precio es requerido' });
    } else if (typeof entry.quantity !== 'number' || entry.quantity < 0) {
      errors.push({ field: 'quantity', message: 'El precio debe ser un número positivo' });
    }

    // Validate unit
    if (!entry.unit || entry.unit.trim() === '') {
      errors.push({ field: 'unit', message: 'La unidad es requerida' });
    }

    return errors;
  }, []);

  // Check for duplicate dates within the same provider
  const checkDuplicateDates = useCallback((fabricId: string, provider: string, excludeId?: string): ValidationError[] => {
    const entries = editingState[fabricId]?.[provider] || [];
    const errors: ValidationError[] = [];
    const dateMap = new Map<string, string[]>();

    entries.forEach(entry => {
      if (excludeId && entry.id === excludeId) return;
      
      const dateStr = entry.date;
      if (dateStr) {
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, []);
        }
        dateMap.get(dateStr)!.push(entry.id);
      }
    });

    dateMap.forEach((entryIds, date) => {
      if (entryIds.length > 1) {
        entryIds.forEach(entryId => {
          errors.push({
            field: 'date',
            message: `Fecha duplicada: ${date}`,
            entryId
          });
        });
      }
    });

    return errors;
  }, [editingState]);

  // Comprehensive validation - only validate entries that are being edited or are new
  const validation = useMemo(() => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    Object.entries(editingState).forEach(([fabricId, providers]) => {
      Object.entries(providers).forEach(([provider, entries]) => {
        // Only validate entries that are being edited or are new
        entries.forEach(entry => {
          if (entry.isEditing || entry.isNew) {
            const entryErrors = validateEntry(entry);
            errors.push(...entryErrors.map(err => ({ ...err, entryId: entry.id })));
          }
        });

        // Check for duplicate dates only among entries being edited/new
        const editingEntries = entries.filter(e => e.isEditing || e.isNew);
        if (editingEntries.length > 0) {
          const duplicateErrors = checkDuplicateDates(fabricId, provider);
          // Only include errors for entries being edited
          const relevantErrors = duplicateErrors.filter(err => 
            editingEntries.some(e => e.id === err.entryId)
          );
          errors.push(...relevantErrors);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [editingState, validateEntry, checkDuplicateDates]);

  // Get entries for a specific provider
  const getEntriesForProvider = useCallback((fabricId: string, provider: string): EditablePriceEntry[] => {
    return editingState[fabricId]?.[provider] || [];
  }, [editingState]);

  // Add new entry
  const addNewEntry = useCallback((fabricId: string, provider: string) => {
    const newEntry: EditablePriceEntry = {
      id: generateEntryId(fabricId, provider),
      provider,
      date: getCurrentDateString(), // Today's date in YYYY-MM-DD format
      quantity: 0,
      unit: 'kg',
      isEditing: true,
      isNew: true,
      originalData: undefined
    };

    setEditingState(prev => ({
      ...prev,
      [fabricId]: {
        ...prev[fabricId],
        [provider]: [...(prev[fabricId]?.[provider] || []), newEntry]
      }
    }));

    // Add to pending changes
    const change: PendingChange = {
      type: 'add',
      fabricId,
      provider,
      entryId: newEntry.id,
      data: { ...newEntry }
    };

    setPendingChanges(prev => [...prev, change]);
  }, [generateEntryId]);

  // Update entry
  const updateEntry = useCallback((fabricId: string, provider: string, entryId: string, data: Partial<PriceHistoryEntry>) => {
    const currentEntry = editingState[fabricId]?.[provider]?.find(e => e.id === entryId);
    
    if (!currentEntry) {
      return;
    }

    // Update the editing state
    setEditingState(prev => {
      const currentEntries = prev[fabricId]?.[provider] || [];
      const updatedEntries = currentEntries.map(entry => {
        if (entry.id === entryId) {
          const updatedEntry = { ...entry, ...data };
          return updatedEntry;
        }
        return entry;
      });

      const newState = {
        ...prev,
        [fabricId]: {
          ...prev[fabricId],
          [provider]: updatedEntries
        }
      };


      return newState;
    });

    // Update pending changes using the current state (before async update)
    setPendingChanges(prev => {
      
      const existingChangeIndex = prev.findIndex(
        change => change.fabricId === fabricId && 
                 change.provider === provider && 
                 change.entryId === entryId
      );

      // Create the updated entry data by merging current entry with new data
      const updatedEntryData = { ...currentEntry, ...data };
      
      
      const updatedChange: PendingChange = {
        type: currentEntry.isNew ? 'add' : 'update',
        fabricId,
        provider,
        entryId,
        data: currentEntry.isNew ? updatedEntryData : data, // For new entries, include all data
        originalData: currentEntry.originalData
      };


      if (existingChangeIndex >= 0) {
        const newChanges = [...prev];
        // For updates, merge the data to preserve all fields
        if (currentEntry.isNew) {
          // For new entries, replace the entire data object
          newChanges[existingChangeIndex] = { ...newChanges[existingChangeIndex], data: updatedEntryData };
        } else {
          // For existing entries, just merge the changed fields
          const existingData = newChanges[existingChangeIndex].data || {};
          const mergedData = { ...existingData, ...data };
          newChanges[existingChangeIndex] = { ...newChanges[existingChangeIndex], data: mergedData };
        }
        return newChanges;
      } else {
        const newChanges = [...prev, updatedChange];
        return newChanges;
      }
    });
  }, [editingState]);

  // Delete entry
  const deleteEntry = useCallback((fabricId: string, provider: string, entryId: string) => {
    const entry = editingState[fabricId]?.[provider]?.find(e => e.id === entryId);
    if (!entry) return;

    // Remove from editing state
    setEditingState(prev => ({
      ...prev,
      [fabricId]: {
        ...prev[fabricId],
        [provider]: prev[fabricId]?.[provider]?.filter(e => e.id !== entryId) || []
      }
    }));

    // Update pending changes
    setPendingChanges(prev => {
      // Remove any existing changes for this entry
      const filteredChanges = prev.filter(
        change => !(change.fabricId === fabricId && 
                   change.provider === provider && 
                   change.entryId === entryId)
      );

      // If it's not a new entry, add a delete change
      if (!entry.isNew && entry.originalData) {
        // Create a unique identifier for the entry to delete
        // This helps the backend identify the exact entry
        const deleteIdentifier = `${entry.originalData.date}-${entry.originalData.provider}-${entry.originalData.unit || 'kg'}-${entry.originalData.quantity}`;
        
        const deleteChange: PendingChange = {
          type: 'delete',
          fabricId,
          provider,
          entryId: deleteIdentifier, // Use the compound identifier
          data: {},
          originalData: entry.originalData
        };
        return [...filteredChanges, deleteChange];
      }

      return filteredChanges;
    });
  }, [editingState]);

  // Cancel edit for a specific entry
  const cancelEdit = useCallback((fabricId: string, provider: string, entryId: string) => {
    const entry = editingState[fabricId]?.[provider]?.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.isNew) {
      // Remove new entry completely
      deleteEntry(fabricId, provider, entryId);
    } else {
      // Restore original data
      setEditingState(prev => {
        const currentEntries = prev[fabricId]?.[provider] || [];
        const updatedEntries = currentEntries.map(e => {
          if (e.id === entryId && e.originalData) {
            return {
              ...e,
              ...e.originalData,
              id: e.id, // Keep the same ID
              isEditing: false,
              originalData: e.originalData
            };
          }
          return e;
        });

        return {
          ...prev,
          [fabricId]: {
            ...prev[fabricId],
            [provider]: updatedEntries
          }
        };
      });

      // Remove from pending changes
      setPendingChanges(prev => 
        prev.filter(
          change => !(change.fabricId === fabricId && 
                     change.provider === provider && 
                     change.entryId === entryId)
        )
      );
    }
  }, [editingState, deleteEntry]);

  // Save all changes
  const saveChanges = useCallback(async (): Promise<boolean> => {

    if (!validation.isValid) {
      toast.error('Hay errores de validación que deben corregirse antes de guardar');
      return false;
    }

    if (pendingChanges.length === 0) {
      toast.info('No hay cambios para guardar');
      return true;
    }

    setIsSaving(true);

    try {
      // Group changes by fabric
      const changesByFabric = new Map<string, PendingChange[]>();
      pendingChanges.forEach(change => {
        if (!changesByFabric.has(change.fabricId)) {
          changesByFabric.set(change.fabricId, []);
        }
        changesByFabric.get(change.fabricId)!.push(change);
      });


      // Prepare bulk update request
      const updates = Array.from(changesByFabric.entries()).map(([fabricId, changes]) => {
        const added: PriceHistoryEntry[] = [];
        const updated: PriceHistoryEntry[] = [];
        const deleted: string[] = [];

        changes.forEach(change => {
          
          switch (change.type) {
            case 'add':
              if (change.data.provider && change.data.date && change.data.quantity !== undefined) {
                const addedEntry = {
                  provider: change.data.provider,
                  date: change.data.date,
                  quantity: change.data.quantity,
                  unit: change.data.unit || 'kg'
                };
                added.push(addedEntry);
              } else {
              }
              break;
            case 'update':
              if (change.originalData && change.data && Object.keys(change.data).length > 0) {
                // For updates, merge original data with changed fields
                const updatedEntry = {
                  provider: change.data.provider ?? change.originalData.provider,
                  date: change.data.date ?? change.originalData.date,
                  quantity: change.data.quantity ?? change.originalData.quantity,
                  unit: change.data.unit ?? change.originalData.unit ?? 'kg',
                  // Include original data for proper identification
                  _originalData: change.originalData
                } as PriceHistoryEntry & { _originalData?: PriceHistoryEntry };
                updated.push(updatedEntry);
              } else {
              }
              break;
            case 'delete':
              if (change.entryId) {
                deleted.push(change.entryId);
              }
              break;
          }
        });

        const fabricUpdate = {
          fabricId,
          changes: { added, updated, deleted }
        };

        return fabricUpdate;
      });

      const bulkRequest: BulkPriceUpdateRequest = { updates };
      

      // Send API request
      const response = await fetch('/api/s3/historial-precios', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bulkRequest),
      });


      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Success
      toast.success(`Cambios guardados exitosamente en ${changesByFabric.size} tela(s)`);
      
      // Clear pending changes
      setPendingChanges([]);
      
      // Refresh data
      onDataUpdated?.();
      
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al guardar cambios: ${errorMessage}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [validation.isValid, pendingChanges, onDataUpdated]);

  // Reset all changes
  const resetChanges = useCallback(() => {
    initializeEditingState();
    setPendingChanges([]);
    toast.info('Cambios descartados');
  }, [initializeEditingState]);

  const hasPendingChanges = pendingChanges.length > 0;

  return {
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
  };
}