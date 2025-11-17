"use client";

import React, { useState, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Edit3,
  Check,
  X,
  Trash2,
  AlertTriangle,
  Calendar
} from "lucide-react";
import type {
  EditablePriceEntry,
  ValidationError,
  PriceHistoryEntry
} from "@/types/price-history";
import { formatDateForDisplay, formatDateForInput, getCurrentDateString } from "@/lib/date-utils";

interface EditablePriceRowProps {
  entry: EditablePriceEntry;
  onUpdate: (data: Partial<PriceHistoryEntry>) => void;
  onDelete: () => void;
  onCancel: () => void;
  errors: ValidationError[];
  validateEntry: (entry: Partial<PriceHistoryEntry>) => ValidationError[];
}

const COMMON_UNITS = ['kg', 'mt'];

export const EditablePriceRow: React.FC<EditablePriceRowProps> = ({
  entry,
  onUpdate,
  onDelete,
  onCancel,
  errors,
  validateEntry,
}) => {
  const [isEditing, setIsEditing] = useState(entry.isNew || false);
  const [localData, setLocalData] = useState({
    date: entry.date,
    quantity: entry.quantity,
    unit: entry.unit || 'kg',
  });
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Update local state when entry changes
  useEffect(() => {
    setLocalData({
      date: entry.date,
      quantity: entry.quantity,
      unit: entry.unit || 'kg',
    });
    setIsEditing(entry.isNew || entry.isEditing || false);
  }, [entry]);

  // Track local changes
  useEffect(() => {
    const hasChanges = 
      localData.date !== entry.date ||
      localData.quantity !== entry.quantity ||
      localData.unit !== (entry.unit || 'kg');
    setHasLocalChanges(hasChanges);
  }, [localData, entry]);

  // Get field-specific errors
  const getFieldErrors = (field: string) => {
    return errors.filter(error => error.field === field);
  };

  const hasErrors = errors.length > 0;
  const dateErrors = getFieldErrors('date');
  const quantityErrors = getFieldErrors('quantity');
  const unitErrors = getFieldErrors('unit');

  // Handle field changes
  const handleFieldChange = (field: keyof typeof localData, value: string | number) => {

    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    
  };

  // Handle save
  const handleSave = () => {

    // Validate before saving
    const validationErrors = validateEntry({
      ...entry,
      ...localData,
    });


    if (validationErrors.length > 0) {
      // Don't save if there are validation errors
      return;
    }

    onUpdate(localData);
    setIsEditing(false);
    setHasLocalChanges(false);
  };

  // Handle cancel
  const handleCancel = () => {
    if (entry.isNew) {
      onCancel();
    } else {
      setLocalData({
        date: entry.originalData?.date || entry.date,
        quantity: entry.originalData?.quantity || entry.quantity,
        unit: entry.originalData?.unit || entry.unit || 'kg',
      });
      setIsEditing(false);
      setHasLocalChanges(false);
      onCancel();
    }
  };

  // Handle edit mode
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date for display (using date utilities to avoid timezone shifts)
  const formatDate = (dateStr: string) => {
    return formatDateForDisplay(dateStr);
  };

  // Get row styling based on state
  const getRowClassName = () => {
    const baseClass = "group hover:bg-gray-50";
    if (entry.isNew) return `${baseClass} bg-green-50`;
    if (isEditing) return `${baseClass} bg-blue-50`;
    if (hasErrors) return `${baseClass} bg-red-50`;
    return baseClass;
  };

  return (
    <TableRow className={getRowClassName()}>
      {/* Date Column */}
      <TableCell>
        {isEditing ? (
          <div className="space-y-1">
            <Input
              type="date"
              value={formatDateForInput(localData.date)}
              onChange={(e) => handleFieldChange('date', e.target.value)}
              className={`w-full ${dateErrors.length > 0 ? 'border-red-500' : ''}`}
              max={getCurrentDateString()}
            />
            {dateErrors.map((error, index) => (
              <div key={index} className="text-xs text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>{formatDate(entry.date)}</span>
            {dateErrors.length > 0 && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </TableCell>

      {/* Price Column */}
      <TableCell>
        {isEditing ? (
          <div className="space-y-1">
            <Input
              type="number"
              value={entry.isNew && localData.quantity === 0 ? '' : localData.quantity}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                handleFieldChange('quantity', value);
              }}
              className={`w-full ${quantityErrors.length > 0 ? 'border-red-500' : ''}`}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
            {quantityErrors.map((error, index) => (
              <div key={index} className="text-xs text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="font-medium">
              {entry.quantity > 0 ? formatCurrency(entry.quantity) : 'N/A'}
            </span>
            {quantityErrors.length > 0 && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </TableCell>

      {/* Unit Column */}
      <TableCell>
        {isEditing ? (
          <div className="space-y-1">
            <Select
              value={localData.unit}
              onValueChange={(value) => handleFieldChange('unit', value)}
            >
              <SelectTrigger className={`w-full ${unitErrors.length > 0 ? 'border-red-500' : ''}`}>
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
              <div key={index} className="text-xs text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{entry.unit}</Badge>
            {unitErrors.length > 0 && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </TableCell>


      {/* Actions Column */}
      <TableCell>
        <div className="flex items-center space-x-1">
          {isEditing ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSave}
                      disabled={!hasLocalChanges || hasErrors}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Guardar cambios</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancel}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancelar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleEdit}
                      className="h-8 w-8 p-0 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Editar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onDelete}
                      className="h-8 w-8 p-0 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Eliminar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};