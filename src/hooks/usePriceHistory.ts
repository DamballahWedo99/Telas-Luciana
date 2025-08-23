import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { 
  PriceHistoryResponse, 
  FabricPriceHistory,
  MultiProviderTableData,
  FabricProviderMatrix,
  ProviderColumn,
  ProviderPriceData
} from '@/types/price-history';

interface UsePriceHistoryOptions {
  initialFabricIds?: string[];
  autoFetch?: boolean;
}

interface UsePriceHistoryReturn {
  data: PriceHistoryResponse | null;
  multiProviderData: MultiProviderTableData | null;
  loading: boolean;
  error: string | null;
  fetchPriceHistory: (forceRefresh?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
  getFabricHistory: (fabricId: string) => Promise<FabricPriceHistory | null>;
}

export function usePriceHistory(
  options: UsePriceHistoryOptions = {}
): UsePriceHistoryReturn {
  const { initialFabricIds = [], autoFetch = true } = options;
  
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialFetched = useRef(false);

  // Memoize the fabricIds array to prevent unnecessary re-renders
  const fabricIdsString = initialFabricIds.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedFabricIds = useMemo(() => initialFabricIds, [fabricIdsString]);

  // Process data into multi-provider format
  const multiProviderData = useMemo(() => {
    if (!data) return null;

    return processMultiProviderData(data);
  }, [data]);

  const fetchPriceHistory = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      if (memoizedFabricIds.length > 0) {
        params.append('fabricIds', memoizedFabricIds.join(','));
      }

      // Only add refresh=true when explicitly requested
      if (forceRefresh) {
        params.append('refresh', 'true');
      }

      const response = await fetch(`/api/s3/historial-precios?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error fetching price history:', err);
    } finally {
      setLoading(false);
    }
  }, [memoizedFabricIds]);

  const refreshData = useCallback(async () => {
    await fetchPriceHistory(true);
  }, [fetchPriceHistory]);

  const getFabricHistory = useCallback(async (fabricId: string): Promise<FabricPriceHistory | null> => {
    try {
      const response = await fetch(`/api/s3/historial-precios/${fabricId}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (err) {
      console.error(`Error fetching history for fabric ${fabricId}:`, err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch && !hasInitialFetched.current) {
      hasInitialFetched.current = true;
      // Call fetchPriceHistory directly to avoid dependency issues
      fetchPriceHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]); // Intentionally exclude fetchPriceHistory to prevent infinite loop

  return {
    data,
    multiProviderData,
    loading,
    error,
    fetchPriceHistory,
    refreshData,
    getFabricHistory,
  };
}

export function formatPriceChange(change: number, percent: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(1)}%)`;
}

export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'stable': return '→';
    default: return '→';
  }
}

export function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return 'text-red-600';
    case 'down': return 'text-green-600';
    case 'stable': return 'text-gray-600';
    default: return 'text-gray-600';
  }
}

// Process raw price history data into multi-provider table format
export function processMultiProviderData(data: PriceHistoryResponse): MultiProviderTableData {
  const KNOWN_PROVIDERS = ['AD', 'RBK', 'LZ', 'CHANGXING', 'EM', 'ASM', 'MH'];
  
  // Get all unique providers from the data
  const allProviders = new Set<string>();
  data.fabrics.forEach(fabric => {
    fabric.history.forEach(entry => {
      if (entry.provider) {
        allProviders.add(entry.provider.trim().toUpperCase());
      }
    });
  });

  // Combine known providers with discovered ones, prioritizing known providers
  const discoveredProviders = Array.from(allProviders).filter(p => !KNOWN_PROVIDERS.includes(p));
  const orderedProviders = [...KNOWN_PROVIDERS, ...discoveredProviders.sort()];

  // Initialize provider stats
  const providerStats = new Map<string, {
    prices: number[];
    fabrics: Set<string>;
    lastUpdate: string;
  }>();

  orderedProviders.forEach(provider => {
    providerStats.set(provider, {
      prices: [],
      fabrics: new Set(),
      lastUpdate: ''
    });
  });

  // Process each fabric to create the provider matrix
  const fabricMatrices: FabricProviderMatrix[] = data.fabrics.map(fabric => {
    const providers: Record<string, ProviderPriceData | null> = {};
    let hasAnyData = false;

    // Initialize all providers as null
    orderedProviders.forEach(provider => {
      providers[provider] = null;
    });

    // Process history entries for this fabric
    const providerHistory = new Map<string, typeof fabric.history[0][]>();
    
    fabric.history.forEach(entry => {
      const provider = entry.provider?.trim().toUpperCase();
      if (!provider) return;

      if (!providerHistory.has(provider)) {
        providerHistory.set(provider, []);
      }
      providerHistory.get(provider)!.push(entry);
    });

    // For each provider, get the latest entry and calculate trend, but store ALL entries
    providerHistory.forEach((entries, provider) => {
      if (entries.length === 0) return;

      // Sort entries by date (newest first), and add a secondary sort by quantity to ensure consistent ordering
      const sortedEntries = entries.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        
        // Primary sort: by date (newest first)
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        
        // Secondary sort: by quantity (highest first) for consistent ordering when dates are the same
        return (b.quantity || 0) - (a.quantity || 0);
      });

      const latestEntry = sortedEntries[0];
      const previousEntry = sortedEntries[1];

      // Calculate trend if we have at least 2 entries
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let changePercent = 0;

      if (previousEntry && latestEntry.quantity > 0 && previousEntry.quantity > 0) {
        const change = latestEntry.quantity - previousEntry.quantity;
        changePercent = (change / previousEntry.quantity) * 100;
        
        if (changePercent > 1) trend = 'up';
        else if (changePercent < -1) trend = 'down';
      }

      providers[provider] = {
        provider,
        date: latestEntry.date,
        price: latestEntry.quantity,
        unit: latestEntry.unit || 'kg',
        trend,
        changePercent,
        // NEW: Store all historical entries for this provider
        allEntries: sortedEntries,
        totalEntries: sortedEntries.length,
        isLatest: true
      };

      hasAnyData = true;

      // Update provider stats
      const stats = providerStats.get(provider)!;
      stats.prices.push(latestEntry.quantity);
      stats.fabrics.add(fabric.fabricId);
      if (!stats.lastUpdate || new Date(latestEntry.date) > new Date(stats.lastUpdate)) {
        stats.lastUpdate = latestEntry.date;
      }
    });

    // Add empty entries for known providers that don't have data for this fabric
    KNOWN_PROVIDERS.forEach(provider => {
      if (!providers[provider]) {
        providers[provider] = null;
      }
    });

    return {
      fabricId: fabric.fabricId,
      fabricName: fabric.fabricName,
      providers,
      hasAnyData
    };
  });

  // Create provider columns with aggregated stats
  const providerColumns: ProviderColumn[] = orderedProviders
    .map(provider => {
      const stats = providerStats.get(provider);
      const prices = stats ? stats.prices.filter(p => p > 0) : [];

      return {
        id: provider,
        name: provider,
        hasData: prices.length > 0,
        totalFabrics: stats ? stats.fabrics.size : 0,
        avgPrice: prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        lastUpdate: stats ? stats.lastUpdate || '' : ''
      };
    });

  return {
    fabrics: fabricMatrices,
    providers: providerColumns,
    totalFabrics: fabricMatrices.length,
    fabricsWithData: fabricMatrices.filter(f => f.hasAnyData).length
  };
}

// Format date for display in the table without timezone issues
export function formatTableDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Handle dates in YYYY-MM-DD format (avoid timezone conversion)
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [year, month] = parts;
    return `${month}/${year.slice(2)}`;
  }
  
  // Fallback for other formats
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      month: '2-digit', 
      year: '2-digit' 
    });
  } catch {
    return dateStr;
  }
}

// Format full date for display in expanded entries without timezone issues
export function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Handle dates in YYYY-MM-DD format (avoid timezone conversion)
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  
  // Fallback for other formats
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}

// Format currency for display
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format date for min/max display (DD/MM/YYYY format) without timezone issues
export function formatMinMaxDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Handle dates in YYYY-MM-DD format (avoid timezone conversion)
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  
  // Fallback for other formats
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}