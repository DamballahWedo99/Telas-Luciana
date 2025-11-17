import { useState, useCallback } from 'react';
import type { NewProductRequest, NewProductResponse } from '@/types/price-history';

interface ValidationError {
  field: string;
  message: string;
}

interface UseNewProductState {
  fabricName: string;
  provider: string;
  date: string;
  quantity: number;
  unit: string;
}

interface UseNewProductOptions {
  onSuccess?: (response: NewProductResponse) => void;
  existingFabricIds?: string[];
}

interface UseNewProductReturn {
  state: UseNewProductState;
  isLoading: boolean;
  errors: ValidationError[];
  updateField: (field: keyof UseNewProductState, value: string | number) => void;
  validateForm: () => boolean;
  createProduct: () => Promise<boolean>;
  resetForm: () => void;
}

const INITIAL_STATE: UseNewProductState = {
  fabricName: '',
  provider: '',
  date: new Date().toISOString().split('T')[0], // Today's date
  quantity: 0,
  unit: 'kg',
};

export function useNewProduct(options: UseNewProductOptions = {}): UseNewProductReturn {
  const { onSuccess, existingFabricIds = [] } = options;
  
  const [state, setState] = useState<UseNewProductState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Generate fabricId from fabricName (similar to what API does)
  const generateFabricId = useCallback((name: string): string => {
    return name.trim()
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/[^\w\-_]/g, '') // Remove special characters except underscore and hyphen
      .toUpperCase();
  }, []);

  // Validate individual fields
  const validateField = useCallback((field: keyof UseNewProductState, value: string | number): ValidationError | null => {
    switch (field) {
      case 'fabricName':
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return { field, message: 'El nombre del producto es requerido' };
        }
        if (value.trim().length < 2) {
          return { field, message: 'El nombre debe tener al menos 2 caracteres' };
        }
        if (value.trim().length > 100) {
          return { field, message: 'El nombre no puede exceder 100 caracteres' };
        }
        // Check if fabric already exists
        const fabricId = generateFabricId(value.toString());
        if (existingFabricIds.includes(fabricId)) {
          return { field, message: 'Ya existe un producto con este nombre' };
        }
        break;
      
      case 'provider':
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return { field, message: 'El proveedor es requerido' };
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
  }, [existingFabricIds, generateFabricId]);

  // Update field value
  const updateField = useCallback((field: keyof UseNewProductState, value: string | number) => {
    setState(prev => ({ ...prev, [field]: value }));
    
    // Clear errors for this field when user starts typing
    setErrors(prev => prev.filter(error => error.field !== field));
  }, []);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationError[] = [];
    
    Object.keys(state).forEach(key => {
      const field = key as keyof UseNewProductState;
      const error = validateField(field, state[field]);
      if (error) {
        newErrors.push(error);
      }
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [state, validateField]);

  // Create product
  const createProduct = useCallback(async (): Promise<boolean> => {
    if (!validateForm()) {
      return false;
    }

    setIsLoading(true);
    try {
      const request: NewProductRequest = {
        fabricName: state.fabricName.trim(),
        initialPrice: {
          provider: state.provider.trim(),
          date: state.date,
          quantity: state.quantity,
          unit: state.unit,
        },
      };

      const response = await fetch('/api/s3/historial-precios/create', {
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

      const result: NewProductResponse = await response.json();
      
      if (result.success) {
        onSuccess?.(result);
        // Reset form inline to avoid dependency issues
        setState(INITIAL_STATE);
        setErrors([]);
        return true;
      } else {
        setErrors([{ field: 'general', message: result.error || 'Error al crear el producto' }]);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setErrors([{ field: 'general', message: `Error al crear el producto: ${errorMessage}` }]);
      return false;
    } finally {
      setIsLoading(false);
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
    createProduct,
    resetForm,
  };
}