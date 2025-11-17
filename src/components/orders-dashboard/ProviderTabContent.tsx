"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  AlertTriangle,
  Info,
  Package
} from "lucide-react";
import { EditablePriceRow } from "./EditablePriceRow";
import type {
  EditablePriceEntry,
  ValidationError,
  PriceHistoryEntry
} from "@/types/price-history";

interface ProviderTabContentProps {
  provider: string;
  entries: EditablePriceEntry[];
  onAddEntry: () => void;
  onUpdateEntry: (entryId: string, data: Partial<PriceHistoryEntry>) => void;
  onDeleteEntry: (entryId: string) => void;
  onCancelEdit: (entryId: string) => void;
  validateEntry: (entry: Partial<PriceHistoryEntry>) => ValidationError[];
  errors: ValidationError[];
}

export const ProviderTabContent: React.FC<ProviderTabContentProps> = ({
  provider,
  entries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onCancelEdit,
  validateEntry,
  errors,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sort entries by date
  const sortedEntries = [...entries].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });


  // Get errors for this provider
  const providerErrors = errors.filter(error => 
    entries.some(entry => entry.id === error.entryId)
  );

  // Handle add new entry
  const handleAddEntry = () => {
    if (showAddForm) {
      setShowAddForm(false);
    } else {
      onAddEntry();
      setShowAddForm(true);
    }
  };

  // Check if any entry is being edited
  const hasEditingEntries = entries.some(entry => entry.isEditing);



  return (
    <div className="h-full flex flex-col space-y-4">

      {/* Error alerts */}
      {providerErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {providerErrors.length} error{providerErrors.length !== 1 ? 'es' : ''} de validación en esta pestaña
          </AlertDescription>
        </Alert>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">
            Historial de Precios - {provider}
          </h3>
          {entries.some(e => e.isNew) && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Nuevos registros
            </Badge>
          )}
          {entries.some(e => e.isEditing && !e.isNew) && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Editando
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            Fecha {sortOrder === 'desc' ? '↓' : '↑'}
          </Button>
          
          <Button
            onClick={handleAddEntry}
            size="sm"
            disabled={hasEditingEntries}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Precio
          </Button>
        </div>
      </div>

      {/* Info about editing */}
      {hasEditingEntries && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Completa o cancela las ediciones actuales antes de agregar nuevos registros.
          </AlertDescription>
        </Alert>
      )}

      {/* Price history table */}
      <div className="flex-1 border rounded-lg">
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Fecha</TableHead>
                <TableHead className="w-[120px]">Precio</TableHead>
                <TableHead className="w-[80px]">Unidad</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <Package className="h-8 w-8 text-gray-400" />
                      <span>No hay registros de precios para {provider}</span>
                      <Button onClick={onAddEntry} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar primer precio
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedEntries.map((entry) => (
                  <EditablePriceRow
                    key={entry.id}
                    entry={entry}
                    onUpdate={(data) => {
                      onUpdateEntry(entry.id, data);
                    }}
                    onDelete={() => onDeleteEntry(entry.id)}
                    onCancel={() => onCancelEdit(entry.id)}
                    errors={errors.filter(error => error.entryId === entry.id)}
                    validateEntry={validateEntry}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

    </div>
  );
};