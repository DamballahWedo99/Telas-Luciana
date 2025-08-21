export interface PriceHistoryEntry {
  provider: string;
  date: string;
  quantity: number;
  unit: string | null;
}

export interface FabricPriceHistory {
  fabricId: string;
  fabricName: string;
  history: PriceHistoryEntry[];
  lastUpdated?: string;
}

export interface PriceHistorySummary {
  fabricId: string;
  fabricName: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePercent: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
  totalEntries: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  // New fields for min/max provider and date info
  minPriceProvider: string;
  minPriceDate: string;
  maxPriceProvider: string;
  maxPriceDate: string;
}

export interface PriceComparisonData {
  date: string;
  [fabricId: string]: string | number;
}

export interface PriceHistoryFilters {
  fabricIds: string[];
  dateFrom?: string;
  dateTo?: string;
  providers?: string[];
  units?: string[];
}

export interface PriceHistoryChartData {
  date: string;
  price: number;
  fabricName: string;
  provider: string;
  quantity: number;
  unit: string;
}

export interface PriceHistoryTableRow {
  id: string;
  fabricName: string;
  provider: string;
  date: string;
  quantity: number;
  unit: string;
  pricePerUnit?: number;
}

// New types for multi-provider table
export interface ProviderPriceData {
  provider: string;
  date: string;
  price: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
  // New fields for full historical data
  allEntries?: PriceHistoryEntry[];
  totalEntries?: number;
  isLatest?: boolean;
}

export interface FabricProviderMatrix {
  fabricId: string;
  fabricName: string;
  providers: Record<string, ProviderPriceData | null>;
  hasAnyData: boolean;
  // New field to track expansion state
  isExpanded?: boolean;
}

export interface ProviderColumn {
  id: string;
  name: string;
  hasData: boolean;
  totalFabrics: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  lastUpdate: string;
}

export interface MultiProviderTableData {
  fabrics: FabricProviderMatrix[];
  providers: ProviderColumn[];
  totalFabrics: number;
  fabricsWithData: number;
}

export interface PriceHistoryResponse {
  fabrics: FabricPriceHistory[];
  summary: PriceHistorySummary[];
  totalFabrics: number;
  dateRange: {
    from: string;
    to: string;
  };
}

export interface FabricMetadata {
  id: string;
  name: string;
  hasHistory: boolean;
  entryCount: number;
  lastUpdate: string;
}

// Types for price editing system
export interface EditablePriceEntry extends PriceHistoryEntry {
  id: string;
  isEditing?: boolean;
  isNew?: boolean;
  originalData?: PriceHistoryEntry;
}

export interface PendingChange {
  type: 'add' | 'update' | 'delete';
  fabricId: string;
  provider: string;
  entryId?: string;
  data: Partial<PriceHistoryEntry>;
  originalData?: PriceHistoryEntry;
}

export interface PriceEditingState {
  [fabricId: string]: {
    [provider: string]: EditablePriceEntry[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
  entryId?: string;
}

export interface PriceEditValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface PriceUpdateRequest {
  fabricId: string;
  changes: {
    added: PriceHistoryEntry[];
    updated: PriceHistoryEntry[];
    deleted: string[]; // entry IDs
  };
}

export interface BulkPriceUpdateRequest {
  updates: PriceUpdateRequest[];
}

export interface PriceUpdateResponse {
  success: boolean;
  fabricId: string;
  message?: string;
  errors?: string[];
}