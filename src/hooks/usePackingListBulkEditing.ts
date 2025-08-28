import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PackingListRoll } from '../../types/types';

export interface EditablePackingListRoll extends PackingListRoll {
  id: string;
  isEditing: boolean;
  isNew: boolean;
  hasChanges: boolean;
  originalData?: PackingListRoll;
}

export interface PendingRollChange {
  type: 'add' | 'update' | 'delete';
  rollId: string;
  data: Partial<PackingListRoll>;
  originalData?: PackingListRoll;
}

export interface RollValidationError {
  field: string;
  message: string;
  rollId?: string;
}

export interface RollValidation {
  isValid: boolean;
  errors: RollValidationError[];
  warnings: RollValidationError[];
}


interface UsePackingListBulkEditingOptions {
  onDataUpdated?: () => void;
}

interface UsePackingListBulkEditingReturn {
  editingRolls: EditablePackingListRoll[];
  pendingChanges: PendingRollChange[];
  hasPendingChanges: boolean;
  validation: RollValidation;
  isSaving: boolean;
  
  // Data management
  initializeRolls: (rolls: PackingListRoll[], force?: boolean) => void;
  
  // Individual roll operations
  updateRoll: (rollId: string, data: Partial<PackingListRoll>) => void;
  deleteRoll: (rollId: string) => void;
  startEditingRoll: (rollId: string) => void;
  cancelEditingRoll: (rollId: string) => void;
  
  // Save operations
  saveChanges: () => Promise<boolean>;
  resetChanges: () => void;
  
  // Filter context management
  resetEditingState: () => void;
  clearAllState: () => void;
  
  // Utilities
  validateRoll: (roll: Partial<PackingListRoll>) => RollValidationError[];
}

export function usePackingListBulkEditing(
  options: UsePackingListBulkEditingOptions
): UsePackingListBulkEditingReturn {
  const { onDataUpdated } = options;
  
  const [editingRolls, setEditingRolls] = useState<EditablePackingListRoll[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingRollChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // KISS: Store original data copy for instant reset
  const originalRollsRef = useRef<EditablePackingListRoll[]>([]);
  
  // Protection flag and timing tracking for reset operations
  const [isResetting, setIsResetting] = useState(false);
  const resetProtectionRef = useRef<NodeJS.Timeout | null>(null);
  const lastResetTimestamp = useRef<number>(0);
  const lastInitializeRollsData = useRef<string>('');

  // Initialize rolls from data with surgical race condition prevention
  const initializeRolls = useCallback((rolls: PackingListRoll[], force?: boolean) => {
    const currentTimestamp = Date.now();
    const timeSinceLastReset = currentTimestamp - lastResetTimestamp.current;
    const rollsSignature = JSON.stringify(rolls.slice(0, 5).map(r => ({ OC: r.OC, tela: r.tela, rollo_id: r.rollo_id })));
    
    // FORCE OVERRIDE: Allow legitimate calls to bypass all protection
    if (force) {
      // Clear any existing protection
      if (resetProtectionRef.current) {
        clearTimeout(resetProtectionRef.current);
        resetProtectionRef.current = null;
      }
      setIsResetting(false);
    } else {
      // Clear any existing reset protection timeout when new data arrives
      if (resetProtectionRef.current) {
        clearTimeout(resetProtectionRef.current);
        resetProtectionRef.current = null;
        setIsResetting(false); // Allow new data to proceed
      }
      
      // SURGICAL PROTECTION: Only block if it's an immediate duplicate call (likely race condition)
      if (rollsSignature === lastInitializeRollsData.current && timeSinceLastReset < 500) {
        return;
      }
    }
    
    // SMART MERGE DETECTION - only if very recent reset AND we have meaningful existing state AND not forced
    if (!force && isResetting && timeSinceLastReset < 1000 && editingRolls.length > 0 && pendingChanges.length > 0) {
      const newRollIds = new Set(rolls.map(r => `${r.OC}_${r.tela}_${r.color}_${r.lote}_${r.rollo_id}`));
      
      // Find rolls that exist in current state but not in new data (likely restored deleted rolls)
      const potentialDeletedRolls = editingRolls.filter(roll => !newRollIds.has(roll.id));
      
      if (potentialDeletedRolls.length > 0) {
        const editableRolls = rolls.map((roll) => ({
          ...roll,
          id: `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}`,
          isEditing: false,
          isNew: false,
          hasChanges: false,
          originalData: { ...roll }
        }));
        
        // Add preserved rolls that aren't duplicates
        const combinedRolls: EditablePackingListRoll[] = [...editableRolls];
        potentialDeletedRolls.forEach(deletedRoll => {
          if (!editableRolls.some(r => r.id === deletedRoll.id)) {
            const preservedRoll: EditablePackingListRoll = {
              ...deletedRoll,
              isEditing: false,
              isNew: false,
              hasChanges: false,
              originalData: deletedRoll.originalData
            };
            combinedRolls.push(preservedRoll);
          }
        });
        
        setEditingRolls(combinedRolls);
        lastInitializeRollsData.current = rollsSignature;
        setIsResetting(false); // Clear protection after successful merge
        return;
      }
    }
    
    // NORMAL INITIALIZATION PATH
    const editableRolls = rolls.map((roll) => ({
      ...roll,
      id: `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}`,
      isEditing: false,
      isNew: false,
      hasChanges: false,
      originalData: { ...roll }
    }));
    
    setEditingRolls(editableRolls);
    // KISS: Store original copy for instant reset
    originalRollsRef.current = [...editableRolls];
    setPendingChanges([]);
    
    // Update signature tracking
    lastInitializeRollsData.current = rollsSignature;
  }, [isResetting, editingRolls, pendingChanges.length]);

  // Validate individual roll
  const validateRoll = useCallback((roll: Partial<PackingListRoll>): RollValidationError[] => {
    const errors: RollValidationError[] = [];

    // Validate cantidad
    if (roll.cantidad === undefined || roll.cantidad === null) {
      errors.push({ field: 'cantidad', message: 'La cantidad es requerida' });
    } else if (typeof roll.cantidad !== 'number' || roll.cantidad < 0) {
      errors.push({ field: 'cantidad', message: 'La cantidad debe ser un número positivo' });
    }

    // Validate status
    if (!roll.status || roll.status.trim() === '') {
      errors.push({ field: 'status', message: 'El estado es requerido' });
    }

    // Validate OC
    if (!roll.OC || roll.OC.trim() === '') {
      errors.push({ field: 'OC', message: 'La orden de compra es requerida' });
    }

    // Validate tela
    if (!roll.tela || roll.tela.trim() === '') {
      errors.push({ field: 'tela', message: 'La tela es requerida' });
    }

    // Validate color
    if (!roll.color || roll.color.trim() === '') {
      errors.push({ field: 'color', message: 'El color es requerido' });
    }

    // Validate lote
    if (!roll.lote || roll.lote.trim() === '') {
      errors.push({ field: 'lote', message: 'El lote es requerido' });
    }

    // Validate unidad
    if (!roll.unidad || (roll.unidad !== 'KG' && roll.unidad !== 'MTS')) {
      errors.push({ field: 'unidad', message: 'La unidad debe ser KG o MTS' });
    }

    return errors;
  }, []);

  // Comprehensive validation - using editingRolls directly from state
  const validation = useMemo((): RollValidation => {
    const errors: RollValidationError[] = [];
    const warnings: RollValidationError[] = [];

    // Validate only rolls that are being edited or are new
    editingRolls.forEach(roll => {
      if (roll.isEditing || roll.isNew || roll.hasChanges) {
        const rollErrors = validateRoll(roll);
        errors.push(...rollErrors.map(err => ({ ...err, rollId: roll.id })));
      }
    });

    // Check for duplicate roll combinations (OC + tela + color + lote + rollo_id)
    const rollCombinations = new Set<string>();
    editingRolls.forEach(roll => {
      const combination = `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}`;
      if (rollCombinations.has(combination)) {
        warnings.push({
          field: 'rollo_id',
          message: `Rollo duplicado: OC ${roll.OC}, Tela ${roll.tela}, Color ${roll.color}, Lote ${roll.lote}, Rollo ${roll.rollo_id}`,
          rollId: roll.id
        });
      }
      rollCombinations.add(combination);
    });

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    return result;
  }, [editingRolls, validateRoll]);


  // Individual roll operations
  const startEditingRoll = useCallback((rollId: string) => {
    setEditingRolls(prev => prev.map(roll => 
      roll.id === rollId ? { ...roll, isEditing: true } : roll
    ));
  }, []);

  const deleteRoll = useCallback((rollId: string) => {
    setEditingRolls(prev => {
      const roll = prev.find(r => r.id === rollId);
      if (!roll) {
        return prev;
      }

      const filtered = prev.filter(r => r.id !== rollId);

      // Update pending changes using the current roll data
      setPendingChanges(prevChanges => {
        const filteredChanges = prevChanges.filter(change => change.rollId !== rollId);

        if (!roll.isNew && roll.originalData) {
          const deleteChange: PendingRollChange = {
            type: 'delete',
            rollId,
            data: {},
            originalData: roll.originalData
          };
          
          const updatedChanges = [...filteredChanges, deleteChange];
          return updatedChanges;
        }

        return filteredChanges;
      });

      return filtered;
    });
  }, []);

  const cancelEditingRoll = useCallback((rollId: string) => {
    setEditingRolls(prevRolls => {
      const roll = prevRolls.find(r => r.id === rollId);
      
      // Handle regular roll operations (existing roll found in editingRolls)
      if (roll) {
        if (roll.isNew) {
          // Remove new roll completely
          setPendingChanges(prev => prev.filter(change => change.rollId !== rollId));
          return prevRolls.filter(r => r.id !== rollId);
        } else {
          // Restore original data for existing roll
          setPendingChanges(prev => prev.filter(change => change.rollId !== rollId));
          return prevRolls.map(r => 
            r.id === rollId && r.originalData ? {
              ...r.originalData,
              id: r.id,
              isEditing: false,
              isNew: false,
              hasChanges: false,
              originalData: r.originalData
            } : r
          );
        }
      }
      
      return prevRolls;
    });

    // Handle canceling deletion of a roll (check pending changes)
    setPendingChanges(prevChanges => {
      const pendingChange = prevChanges.find(c => c.rollId === rollId);
      
      if (pendingChange?.type === 'delete' && pendingChange.originalData) {
        // Restore the deleted roll back to editingRolls
        setEditingRolls(prevRolls => {
          const restoredRoll: EditablePackingListRoll = {
            ...pendingChange.originalData!,
            id: rollId,
            isEditing: false,
            isNew: false,
            hasChanges: false,
            originalData: pendingChange.originalData
          };
          
          const updated = [...prevRolls, restoredRoll];
          return updated;
        });
        
        // Remove the delete operation from pending changes
        return prevChanges.filter(change => change.rollId !== rollId);
      }

      return prevChanges;
    });
  }, []);

  const updateRoll = useCallback((rollId: string, data: Partial<PackingListRoll>) => {
    // Update editing state using functional updates to avoid stale closures
    setEditingRolls(prev => {
      const currentRoll = prev.find(roll => roll.id === rollId);
      if (!currentRoll) {
        return prev;
      }

      const updated = prev.map(roll => {
        if (roll.id === rollId) {
          const updatedRoll = { ...roll, ...data, hasChanges: true };
          
          // Update pending changes using the current roll context
          setPendingChanges(prevChanges => {
            const existingChangeIndex = prevChanges.findIndex(change => change.rollId === rollId);
            const updatedRollData = { ...currentRoll, ...data };
            
            const updatedChange: PendingRollChange = {
              type: currentRoll.isNew ? 'add' : 'update',
              rollId,
              data: currentRoll.isNew ? updatedRollData : data,
              originalData: currentRoll.originalData
            };

            if (existingChangeIndex >= 0) {
              const newChanges = [...prevChanges];
              if (currentRoll.isNew) {
                newChanges[existingChangeIndex] = { ...newChanges[existingChangeIndex], data: updatedRollData };
              } else {
                const existingData = newChanges[existingChangeIndex].data || {};
                const mergedData = { ...existingData, ...data };
                newChanges[existingChangeIndex] = { ...newChanges[existingChangeIndex], data: mergedData };
              }
              return newChanges;
            } else {
              const newChanges = [...prevChanges, updatedChange];
              return newChanges;
            }
          });
          
          return updatedRoll;
        }
        return roll;
      });
      
      return updated;
    });
  }, []);


  // Validate data consistency before save (prevents cache/S3 mismatch issues)
  const validateDataConsistency = useCallback((changes: PendingRollChange[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    changes.forEach((change, index) => {
      // For updates and deletes, originalData is REQUIRED to prevent wrong roll edits
      if (change.type === 'update' || change.type === 'delete') {
        if (!change.originalData) {
          const error = `CRITICAL: Cambio ${change.type} para rollo ${change.rollId} no tiene originalData - riesgo de integridad de datos`;
          console.error(error);
          errors.push(error);
        } else {
          // Validate originalData has all required fields
          const requiredFields = ['OC', 'tela', 'color', 'lote', 'rollo_id'];
          for (const field of requiredFields) {
            const value = change.originalData[field as keyof PackingListRoll];
            if (!value || (typeof value === 'string' && value.trim() === '')) {
              const error = `CRITICAL: originalData para rollo ${change.rollId} tiene campo vacío: ${field}`;
              console.error(error);
              errors.push(error);
            }
          }
        }
      }
      
      // For adds, validate the data has required fields
      if (change.type === 'add') {
        const requiredFields = ['OC', 'tela', 'color', 'lote', 'rollo_id', 'cantidad', 'unidad'];
        for (const field of requiredFields) {
          const value = change.data[field as keyof PackingListRoll];
          if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
            const error = `CRITICAL: Nuevo rollo ${change.rollId} tiene campo vacío: ${field}`;
            console.error(error);
            errors.push(error);
          }
        }
      }
    });
    
    const result = { isValid: errors.length === 0, errors };
    
    return result;
  }, []);

  // Save all changes
  const saveChanges = useCallback(async (): Promise<boolean> => {
    // Show loader immediately
    setIsSaving(true);
    
    try {
      if (!validation.isValid) {
        toast.error('Hay errores de validación que deben corregirse antes de guardar');
        setIsSaving(false);
        return false;
      }

      if (pendingChanges.length === 0) {
        toast.info('No hay cambios para guardar');
        setIsSaving(false);
        return true;
      }

      // CRITICAL: Validate data consistency before API call
      const consistencyValidation = validateDataConsistency(pendingChanges);
      if (!consistencyValidation.isValid) {
        console.error('Data consistency validation failed!');
        consistencyValidation.errors.forEach(error => console.error(error));
        toast.error(`Error crítico de integridad de datos. Ver consola para detalles. ${consistencyValidation.errors.length} errores detectados.`);
        setIsSaving(false);
        return false;
      }
      
      // Prepare the changes for API
      const changesForApi = pendingChanges.map(change => ({
        type: change.type,
        rollId: change.rollId,
        data: change.data,
        originalData: change.originalData
      }));

      const response = await fetch('/api/packing-list/bulk-edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes: changesForApi }),
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.error || `Error ${response.status}: ${response.statusText}`;
        } catch (parseError) {
          errorText = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorText);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Success
      toast.success(`Cambios guardados exitosamente: ${pendingChanges.length} modificaciones`);
      
      // Clear pending changes and reset states
      setPendingChanges([]);
      
      // Update all rolls to remove editing flags
      setEditingRolls(prev => {
        const updated = prev.map(roll => ({
          ...roll,
          isEditing: false,
          hasChanges: false
        }));
        return updated;
      });
      
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Save operation failed:', error);
      toast.error(`Error al guardar cambios: ${errorMessage}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [validation.isValid, validation.errors, validation.warnings, pendingChanges, validateDataConsistency]);

  // Reset all changes - RESTORE ORIGINAL DATA (following PriceEditModal pattern)
  const resetChanges = useCallback(() => {
    // Clear any existing protection timeout
    if (resetProtectionRef.current) {
      clearTimeout(resetProtectionRef.current);
      resetProtectionRef.current = null;
    }
    
    // KISS: Simply restore from original copy
    setEditingRolls([...originalRollsRef.current]);
    
    // Clear pending changes
    setPendingChanges([]);
    setIsResetting(false);
    
    toast.info('Cambios descartados');
  }, [editingRolls]);

  // Reset editing state only (for filter context changes)
  const resetEditingState = useCallback(() => {
    setEditingRolls(prev => prev.map(roll => ({
      ...roll,
      isEditing: false,
      hasChanges: false
    })));
    setPendingChanges([]);
  }, []);

  // Clear all state and tracking (for modal close)
  const clearAllState = useCallback(() => {
    setEditingRolls([]);
    setPendingChanges([]);
    setIsResetting(false);
    originalRollsRef.current = []; // KISS: Clear original copy
    lastResetTimestamp.current = 0;
    lastInitializeRollsData.current = '';
    if (resetProtectionRef.current) {
      clearTimeout(resetProtectionRef.current);
      resetProtectionRef.current = null;
    }
  }, []);

  const hasPendingChanges = pendingChanges.length > 0;


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resetProtectionRef.current) {
        clearTimeout(resetProtectionRef.current);
        resetProtectionRef.current = null;
      }
    };
  }, []);
  
  return {
    editingRolls,
    pendingChanges,
    hasPendingChanges,
    validation,
    isSaving,
    
    // Core operations
    initializeRolls,
    updateRoll,
    deleteRoll,
    startEditingRoll,
    cancelEditingRoll,
    
    saveChanges,
    resetChanges,
    
    resetEditingState,
    clearAllState,
    
    validateRoll
  };
}