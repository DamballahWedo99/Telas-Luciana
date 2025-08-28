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
} from "lucide-react";
import type { EditablePackingListRoll, RollValidationError } from "../../hooks/usePackingListBulkEditing";
import type { PackingListRoll } from "../../../types/types";

interface EditablePackingListRowProps {
  roll: EditablePackingListRoll;
  onUpdate: (data: Partial<PackingListRoll>) => void;
  onDelete: () => void;
  onCancel: () => void;
  errors: RollValidationError[];
  validateRoll: (roll: Partial<PackingListRoll>) => RollValidationError[];
}

const UNIT_OPTIONS = ['KG', 'MTS'];

export const EditablePackingListRow: React.FC<EditablePackingListRowProps> = ({
  roll,
  onUpdate,
  onDelete,
  onCancel,
  errors,
  validateRoll,
}) => {
  const [isEditing, setIsEditing] = useState(roll.isNew || false);
  const [localData, setLocalData] = useState({
    cantidad: roll.cantidad,
    unidad: roll.unidad,
  });
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Update local state when roll changes
  useEffect(() => {
    setLocalData({
      cantidad: roll.cantidad,
      unidad: roll.unidad,
    });
    setIsEditing(roll.isNew || roll.isEditing || false);
  }, [roll]);

  // Track local changes
  useEffect(() => {
    // Use more precise comparison for numeric values to detect small changes
    const cantidadChanged = Math.abs(localData.cantidad - roll.cantidad) > 0.001;
    const unidadChanged = localData.unidad !== roll.unidad;
    const hasChanges = cantidadChanged || unidadChanged;
    setHasLocalChanges(hasChanges);
  }, [localData, roll]);

  // Get field-specific errors
  const getFieldErrors = (field: string) => {
    return errors.filter(error => error.field === field);
  };

  const hasErrors = errors.length > 0;
  const cantidadErrors = getFieldErrors('cantidad');
  const unidadErrors = getFieldErrors('unidad');

  // Handle field changes
  const handleFieldChange = (field: keyof typeof localData, value: string | number) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
  };

  // Handle save
  const handleSave = () => {
    // Validate before saving
    const validationErrors = validateRoll({
      ...roll,
      ...localData,
    });

    if (validationErrors.length > 0) {
      return;
    }

    onUpdate(localData);
    setIsEditing(false);
    setHasLocalChanges(false);
  };

  // Handle cancel
  const handleCancel = () => {
    if (roll.isNew) {
      onCancel();
    } else {
      setLocalData({
        cantidad: roll.originalData?.cantidad || roll.cantidad,
        unidad: roll.originalData?.unidad || roll.unidad,
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

  // Get row styling based on state
  const getRowClassName = () => {
    const baseClass = "group hover:bg-gray-50 transition-colors";
    if (roll.isNew) return `${baseClass} bg-green-50`;
    if (isEditing) return `${baseClass} bg-blue-50`;
    if (hasErrors) return `${baseClass} bg-red-50`;
    if (roll.hasChanges) return `${baseClass} bg-orange-50`;
    return baseClass;
  };

  return (
    <TableRow className={getRowClassName()}>
      {/* Rollo ID */}
      <TableCell>
        <span className="font-mono text-sm">{roll.rollo_id || 'N/A'}</span>
      </TableCell>

      {/* Cantidad */}
      <TableCell>
        {isEditing ? (
          <div className="space-y-1">
            <Input
              type="number"
              value={localData.cantidad === 0 ? '' : localData.cantidad}
              onChange={(e) => {
                const inputValue = e.target.value;
                if (inputValue === '') {
                  handleFieldChange('cantidad', 0);
                } else {
                  const value = parseFloat(inputValue);
                  if (!isNaN(value) && value >= 0) {
                    handleFieldChange('cantidad', value);
                  }
                }
              }}
              className={`w-full ${cantidadErrors.length > 0 ? 'border-red-500' : ''}`}
              placeholder="Ingrese cantidad..."
              step="0.01"
              min="0"
            />
            {cantidadErrors.map((error, index) => (
              <div key={index} className="text-xs text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="font-medium">{roll.cantidad}</span>
            {cantidadErrors.length > 0 && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </TableCell>

      {/* Unidad */}
      <TableCell>
        {isEditing ? (
          <div className="space-y-1">
            <Select
              value={localData.unidad}
              onValueChange={(value) => handleFieldChange('unidad', value)}
            >
              <SelectTrigger className={`w-full ${unidadErrors.length > 0 ? 'border-red-500' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unidadErrors.map((error, index) => (
              <div key={index} className="text-xs text-red-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {error.message}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{roll.unidad}</Badge>
            {unidadErrors.length > 0 && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </TableCell>

      {/* Actions */}
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