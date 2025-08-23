"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ProviderStats {
  totalEntries: number;
  hasChanges: boolean;
  newEntries: number;
  changedEntries: number;
  deletedEntries: number;
}

interface ProviderOption {
  providerId: string;
  providerName: string;
  stats?: ProviderStats;
}

interface ProviderComboboxProps {
  providers: ProviderOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ProviderCombobox({
  providers,
  value,
  onValueChange,
  placeholder = "Seleccionar proveedor...",
  className,
  disabled = false,
}: ProviderComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Find the selected provider
  const selectedProvider = React.useMemo(() => {
    return providers.find((provider) => provider.providerId === value);
  }, [providers, value]);

  // Filter providers based on search
  const filteredProviders = React.useMemo(() => {
    if (!search) return providers;
    
    const searchLower = search.toLowerCase();
    return providers.filter(
      (provider) =>
        provider.providerName.toLowerCase().includes(searchLower) ||
        provider.providerId.toLowerCase().includes(searchLower)
    );
  }, [providers, search]);

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
        <span className="truncate flex items-center space-x-2">
          <span>{selectedProvider ? selectedProvider.providerName : placeholder}</span>
          {selectedProvider?.stats?.hasChanges && (
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          )}
          {selectedProvider?.stats && selectedProvider.stats.totalEntries > 0 && (
            <Badge variant="outline" className="text-xs">
              {selectedProvider.stats.totalEntries}
            </Badge>
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div 
          className="absolute top-full left-0 w-full min-w-[300px] mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-0"
          style={{ zIndex: 9999 }}
        >
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Buscar proveedor..." 
              className="h-9"
              value={search}
              onValueChange={handleSearchChange}
              autoFocus
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                No se encontraron proveedores.
              </CommandEmpty>
              <CommandGroup>
                {filteredProviders.map((provider) => (
                  <CommandItem
                    key={provider.providerId}
                    value={provider.providerId}
                    onSelect={() => handleSelect(provider.providerId)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === provider.providerId ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{provider.providerName}</span>
                        {provider.stats?.hasChanges && (
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        )}
                      </div>
                      {provider.stats && provider.stats.totalEntries > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {provider.stats.totalEntries}
                        </Badge>
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