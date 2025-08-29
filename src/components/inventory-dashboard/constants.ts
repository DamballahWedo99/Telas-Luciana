/**
 * Constants for InventoryCard component
 */

// Location constants
export const LOCATIONS = {
  CDMX: "CDMX",
  MERIDA: "Mérida",
  MID: "MID", // API code for Mérida
} as const;

export type LocationType = typeof LOCATIONS[keyof typeof LOCATIONS];

// Location mappings for API
export const LOCATION_API_MAP = {
  [LOCATIONS.CDMX]: "CDMX",
  [LOCATIONS.MERIDA]: "MID",
} as const;

// Status constants
export const ITEM_STATUS = {
  PENDING: "pending",
  USED: "used",
  ACTIVE: "active",
} as const;

// Date and year constants
export const DATE_CONFIG = {
  START_YEAR: 2025,
  DEFAULT_LOCATION: LOCATIONS.CDMX,
} as const;

// TTL patterns for special handling
export const TTL_PATTERNS = [
  "ttl-04-25",
  "ttl-02-2025",
] as const;

// Default values
export const DEFAULTS = {
  LOCATION: LOCATIONS.CDMX,
  WAREHOUSE: LOCATIONS.CDMX,
} as const;

// Location select options for forms
export const LOCATION_OPTIONS = [
  { value: LOCATIONS.CDMX, label: LOCATIONS.CDMX },
  { value: LOCATIONS.MERIDA, label: LOCATIONS.MERIDA },
] as const;