import { useState, useCallback } from 'react';
import type { NewProviderRequest, NewProviderResponse, FabricPriceHistory } from '@/types/price-history';

interface ValidationError {
  field: string;
  message: string;
}

interface UseNewProviderState {
  fabricId: string;
  provider: string;
  date: string;
  quantity: number;
  unit: string;
}

interface UseNewProviderOptions {
  onSuccess?: (response: NewProviderResponse) => void;
  availableFabrics?: FabricPriceHistory[];
}

interface UseNewProviderReturn {
  state: UseNewProviderState;
  isLoading: boolean;
  errors: ValidationError[];
  updateField: (field: keyof UseNewProviderState, value: string | number) => void;
  validateForm: () => boolean;
  addProvider: () => Promise<boolean>;
  resetForm: () => void;
}

const INITIAL_STATE: UseNewProviderState = {
  fabricId: '',
  provider: '',
  date: new Date().toISOString().split('T')[0], // Today's date
  quantity: 0,
  unit: 'kg',
};

export function useNewProvider(options: UseNewProviderOptions = {}): UseNewProviderReturn {
  const { onSuccess, availableFabrics = [] } = options;
  
  const [state, setState] = useState<UseNewProviderState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Validate individual fields
  const validateField = useCallback((field: keyof UseNewProviderState, value: string | number): ValidationError | null => {
    switch (field) {
      case 'fabricId':
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return { field, message: 'La tela es requerida' };
        }
        // Check if fabric exists in available fabrics
        if (availableFabrics.length > 0 && !availableFabrics.some(f => f.fabricId === value)) {
          return { field, message: 'La tela seleccionada no existe' };
        }
        break;
      
      case 'provider':
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return { field, message: 'El proveedor es requerido' };
        }
        if (value.trim().length < 2) {
          return { field, message: 'El proveedor debe tener al menos 2 caracteres' };
        }
        if (value.trim().length > 50) {
          return { field, message: 'El proveedor no puede exceder 50 caracteres' };
        }
        break;
      
      case 'date':
        if (!value || typeof value !== 'string') {
          return { field, message: 'La fecha es requerida' };
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { field, message: 'Fecha inválida' };
        }
        if (date > new Date()) {
          return { field, message: 'La fecha no puede ser en el futuro' };
        }
        break;
      
      case 'quantity':
        if (typeof value !== 'number') {
          return { field, message: 'El precio debe ser un número' };
        }
        if (value <= 0) {
          return { field, message: 'El precio debe ser mayor a 0' };
        }
        if (value > 999999) {
          return { field, message: 'El precio no puede exceder 999,999' };
        }
        break;
      
      case 'unit':
        if (!value || typeof value !== 'string') {
          return { field, message: 'La unidad es requerida' };
        }
        const validUnits = ['kg', 'mt'];
        if (!validUnits.includes(value)) {
          return { field, message: 'Unidad inválida' };
        }
        break;
    }
    return null;
  }, [availableFabrics]);

  // Update field value
  const updateField = useCallback((field: keyof UseNewProviderState, value: string | number) => {
    setState(prev => ({ ...prev, [field]: value }));
    
    // Clear errors for this field when user starts typing
    setErrors(prev => prev.filter(error => error.field !== field));
  }, []);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationError[] = [];
    
    Object.keys(state).forEach(key => {
      const field = key as keyof UseNewProviderState;
      const error = validateField(field, state[field]);
      if (error) {
        newErrors.push(error);
      }
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [state, validateField]);

  // Add provider to existing fabric
  const addProvider = useCallback(async (): Promise<boolean> => {
    if (!validateForm()) {
      return false;
    }

    setIsLoading(true);
    try {
      const request: NewProviderRequest = {
        fabricId: state.fabricId,
        provider: state.provider.trim(),
        date: state.date,
        quantity: state.quantity,
        unit: state.unit,
      };

      const response = await fetch('/api/s3/historial-precios/add-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: NewProviderResponse = await response.json();
      
      if (result.success) {
        
        // Set loading to false first to prevent UI blocking
        setIsLoading(false);
        
        // Call success callback and let parent handle modal closing
        onSuccess?.(result);
        
        // Reset form state after parent has processed the success
        setTimeout(() => {
          setState(INITIAL_STATE);
          setErrors([]);
        }, 100);
        
        return true;
      } else {
        setErrors([{ field: 'general', message: result.error || 'Error al agregar el proveedor' }]);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setErrors([{ field: 'general', message: `Error al agregar el proveedor: ${errorMessage}` }]);
      setIsLoading(false);
      return false;
    }
  }, [state, validateForm, onSuccess]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setState(INITIAL_STATE);
    setErrors([]);
    setIsLoading(false);
  }, []);

  return {
    state,
    isLoading,
    errors,
    updateField,
    validateForm,
    addProvider,
    resetForm,
  };
}