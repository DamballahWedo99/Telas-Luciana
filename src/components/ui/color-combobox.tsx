"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ColorComboboxProps {
  colors: string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rollCounts?: Record<string, number>;
  colorsWithModifications?: Set<string>;
}

export function ColorCombobox({
  colors,
  value,
  onValueChange,
  placeholder = "Seleccionar color...",
  className,
  disabled = false,
  rollCounts = {},
  colorsWithModifications = new Set(),
}: ColorComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Create options including "all" option
  const options = React.useMemo(() => {
    const allColors = colors.map(color => ({
      value: color,
      label: color,
      count: rollCounts[color] || 0
    }));

    const allOption = {
      value: "all",
      label: "Todos los colores",
      count: Object.values(rollCounts).reduce((sum, count) => sum + count, 0)
    };

    return [allOption, ...allColors];
  }, [colors, rollCounts]);

  // Find the selected option
  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value);
  }, [options, value]);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    
    const searchLower = search.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  // Handle selection
  const handleSelect = React.useCallback((selectedValue: string) => {
    if (selectedValue === value) {
      setOpen(false);
      return;
    }
    
    onValueChange(selectedValue);
    setOpen(false);
    setSearch(""); // Clear search when item is selected
  }, [value, onValueChange]);

  // Handle search change
  const handleSearchChange = React.useCallback((searchValue: string) => {
    setSearch(searchValue);
  }, []);

  // Handle button click - toggle dropdown
  const handleButtonClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setOpen(!open);
    if (!open) {
      setSearch(""); // Clear search when opening
    }
  }, [open, disabled]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Handle escape key to close dropdown
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSearch("");
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between h-full"
        disabled={disabled}
        type="button"
        onClick={handleButtonClick}
      >
        <span className="truncate">
          {selectedOption ? (
            <div className="flex items-center space-x-2">
              <span className="font-medium">{selectedOption.label}</span>
              {selectedOption.value !== "all" && colorsWithModifications.has(selectedOption.value) && (
                <div className="w-2 h-2 bg-orange-500 rounded-full" title="Tiene modificaciones pendientes" />
              )}
              <span className="text-sm text-gray-500">
                ({selectedOption.count} rollos)
              </span>
            </div>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div 
          className="absolute top-full left-0 w-full min-w-[180px] mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-0"
          style={{ zIndex: 9999 }}
        >
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Buscar color..." 
              className="h-9"
              value={search}
              onValueChange={handleSearchChange}
              autoFocus
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                No se encontraron colores.
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-2">
                        <span className={cn(
                          "font-medium",
                          option.value === "all" ? "text-blue-600" : ""
                        )}>
                          {option.label}
                        </span>
                        {option.value !== "all" && colorsWithModifications.has(option.value) && (
                          <div className="w-2 h-2 bg-orange-500 rounded-full" title="Tiene modificaciones pendientes" />
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {option.count} rollos
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}