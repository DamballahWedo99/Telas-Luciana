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

export interface ComboboxOption {
  value: string;
  label: string;
  searchableText?: string;
  metadata?: string;
  description?: string;
}

interface GenericComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  showMetadata?: boolean;
  showDescription?: boolean;
}

export function GenericCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  className,
  disabled = false,
  showMetadata = false,
  showDescription = false,
}: GenericComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Find the selected option
  const selectedOption = React.useMemo(() => {
    return options.find((option) => option.value === value);
  }, [options, value]);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    
    const searchLower = search.toLowerCase();
    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(searchLower);
      const searchableMatch = option.searchableText?.toLowerCase().includes(searchLower);
      const metadataMatch = option.metadata?.toLowerCase().includes(searchLower);
      const descriptionMatch = option.description?.toLowerCase().includes(searchLower);
      
      return labelMatch || searchableMatch || metadataMatch || descriptionMatch;
    });
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
        <span className="truncate flex-1 text-left">
          {selectedOption ? (
            <div className="flex items-center space-x-2">
              <span className="font-medium truncate">{selectedOption.label}</span>
              {showMetadata && selectedOption.metadata && (
                <span className="text-sm text-gray-500 flex-shrink-0">
                  {selectedOption.metadata}
                </span>
              )}
            </div>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div 
          className="absolute top-full left-0 w-max min-w-full max-w-[500px] mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-0"
          style={{ zIndex: 9999 }}
        >
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={searchPlaceholder} 
              className="h-9"
              value={search}
              onValueChange={handleSearchChange}
              autoFocus
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                {emptyMessage}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer py-2 px-2"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium break-words">{option.label}</span>
                        {showMetadata && option.metadata && (
                          <span className="text-sm text-gray-500 ml-2 flex-shrink-0">
                            {option.metadata}
                          </span>
                        )}
                      </div>
                      {showDescription && option.description && (
                        <div className="text-sm text-gray-400">
                          <span className="break-words">{option.description}</span>
                        </div>
                      )}
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