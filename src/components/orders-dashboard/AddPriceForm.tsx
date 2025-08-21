"use client";

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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  X,
  AlertTriangle,
  Calendar,
  DollarSign,
  Package
} from "lucide-react";
import type {
  PriceHistoryEntry,
  ValidationError
} from "@/types/price-history";
import { getCurrentDateString, formatDateForDisplay } from "@/lib/date-utils";

interface AddPriceFormProps {
  provider: string;
  onAdd: (entry: PriceHistoryEntry) => void;
  onCancel: () => void;
  validateEntry: (entry: Partial<PriceHistoryEntry>) => ValidationError[];
  existingDates?: string[]; // To check for duplicates
}

const COMMON_UNITS = ['kg', 'mt', 'yrd', 'pza', 'lt'];

export const AddPriceForm: React.FC<AddPriceFormProps> = ({
  provider,
  onAdd,
  onCancel,
  validateEntry,
  existingDates = [],
}) => {
  const [formData, setFormData] = useState({
    date: getCurrentDateString(), // Today's date
    quantity: '',
    unit: 'kg',
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Validate form
  const validateForm = () => {
    const entry: Partial<PriceHistoryEntry> = {
      provider,
      date: formData.date,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
    };

    const validationErrors = validateEntry(entry);

    // Check for duplicate dates
    if (existingDates.includes(formData.date)) {
      validationErrors.push({
        field: 'date',
        message: 'Ya existe un registro para esta fecha'
      });
    }

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const entry: PriceHistoryEntry = {
      provider,
      date: formData.date,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
    };

    onAdd(entry);
  };

  // Handle field changes
  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors for this field
    setErrors(prev => prev.filter(error => error.field !== field));
  };

  // Get field-specific errors
  const getFieldErrors = (field: string) => {
    return errors.filter(error => error.field === field);
  };

  const dateErrors = getFieldErrors('date');
  const quantityErrors = getFieldErrors('quantity');
  const unitErrors = getFieldErrors('unit');

  // Check if form is valid
  const isFormValid = formData.date && formData.quantity && formData.unit && errors.length === 0;

  return (
    <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Plus className="h-5 w-5 mr-2 text-blue-600" />
          Agregar Nuevo Precio - {provider}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General errors */}
          {errors.some(e => !e.field) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {errors.find(e => !e.field)?.message}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Date Field */}
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Fecha
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleFieldChange('date', e.target.value)}
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
                value={formData.quantity}
                onChange={(e) => handleFieldChange('quantity', e.target.value)}
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

            {/* Unit Field */}
            <div className="space-y-2">
              <Label htmlFor="unit" className="flex items-center">
                <Package className="h-4 w-4 mr-1" />
                Unidad
              </Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => handleFieldChange('unit', value)}
              >
                <SelectTrigger className={unitErrors.length > 0 ? 'border-red-500' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            
            <Button
              type="submit"
              disabled={!isFormValid}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Precio
            </Button>
          </div>

          {/* Preview */}
          {formData.date && formData.quantity && (
            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Vista previa:</div>
              <div className="text-sm">
                <strong>{provider}</strong> - {formatDateForDisplay(formData.date)} - {' '}
                {new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: 'MXN'
                }).format(parseFloat(formData.quantity) || 0)} / {formData.unit}
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};