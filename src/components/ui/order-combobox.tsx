"use client";

import * as React from "react";
import { GenericCombobox, type ComboboxOption } from "@/components/ui/generic-combobox";
import type { AvailableOrder } from "../../../types/types";

interface OrderComboboxProps {
  orders: AvailableOrder[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function OrderCombobox({
  orders,
  value,
  onValueChange,
  placeholder = "Seleccionar orden de compra...",
  className,
  disabled = false,
}: OrderComboboxProps) {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Convert orders to ComboboxOption format
  const comboboxOptions: ComboboxOption[] = React.useMemo(() => {
    return orders.map((order) => ({
      value: order.oc,
      label: order.oc,
      searchableText: `${order.oc} ${order.fileName}`,
      metadata: `(${order.rollCount} rollos)`,
      description: `${order.fileName} - ${formatDate(order.lastModified)}`,
    }));
  }, [orders]);

  return (
    <GenericCombobox
      options={comboboxOptions}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar orden de compra..."
      emptyMessage="No se encontraron órdenes de compra."
      className={className}
      disabled={disabled}
      showMetadata={true}
      showDescription={true}
    />
  );
}