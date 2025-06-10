export type UnitType = "MTS" | "KGS";

export interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: UnitType;
  Total: number;
  Ubicacion: string;
  Importacion: "DA" | "HOY" | "-" | "";
  FacturaDragonAzteca: string;
}

export interface NewOrderForm {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: UnitType;
  Ubicacion: string;
  Importacion: "DA" | "HOY";
  FacturaDragonAzteca: string;
}

export interface FabricCostDataPoint {
  x: number;
  y: number;
  z: string;
  size: number;
}

export interface FabricCostData {
  MTS: FabricCostDataPoint[];
  KGS: FabricCostDataPoint[];
}

export interface ParsedCSVData {
  OC?: string;
  Tela?: string;
  Color?: string;
  Costo?: string;
  Cantidad?: string;
  Unidades?: string;
  Ubicacion?: string;
  Importacion?: string;
  Importación?: string;
  "Factura Dragón Azteca"?: string;
  "Factura Dragon Azteca"?: string;
  FacturaDragonAzteca?: string;
  [key: string]: string | undefined;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "major_admin" | "admin" | "seller";
  createdAt: string;
  lastLogin?: string;
}

export interface KeyMetricsType {
  mts: {
    totalQuantity: number;
    totalCost: number;
    itemCount: number;
  };
  kgs: {
    totalQuantity: number;
    totalCost: number;
    itemCount: number;
  };
  overall: {
    totalCost: number;
    itemCount: number;
  };
}

export interface FilterOptions {
  searchTerm: string;
  unitFilter: UnitType | "all";
  ocFilter: string;
  telaFilter: string;
  colorFilter: string;
  ubicacionFilter: string;
}
