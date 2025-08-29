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

interface FabricOption {
  fabricId: string;
  fabricName: string;
}

interface FabricComboboxProps {
  fabrics: FabricOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function FabricCombobox({
  fabrics,
  value,
  onValueChange,
  placeholder = "Seleccionar tela...",
  className,
  disabled = false,
}: FabricComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Find the selected fabric
  const selectedFabric = React.useMemo(() => {
    return fabrics.find((fabric) => fabric.fabricId === value);
  }, [fabrics, value]);

  // Filter fabrics based on search
  const filteredFabrics = React.useMemo(() => {
    if (!search) return fabrics;
    
    const searchLower = search.toLowerCase();
    return fabrics.filter(
      (fabric) =>
        fabric.fabricName.toLowerCase().includes(searchLower) ||
        fabric.fabricId.toLowerCase().includes(searchLower)
    );
  }, [fabrics, search]);

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
          {selectedFabric ? selectedFabric.fabricName : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div 
          className="absolute top-full left-0 w-full max-w-full min-w-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-0"
          style={{ zIndex: 9999 }}
        >
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Buscar tela..." 
              className="h-9"
              value={search}
              onValueChange={handleSearchChange}
              autoFocus
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                No se encontraron telas.
              </CommandEmpty>
              <CommandGroup>
                {filteredFabrics.map((fabric) => (
                  <CommandItem
                    key={fabric.fabricId}
                    value={fabric.fabricId}
                    onSelect={() => handleSelect(fabric.fabricId)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === fabric.fabricId ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-medium">{fabric.fabricName}</span>
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