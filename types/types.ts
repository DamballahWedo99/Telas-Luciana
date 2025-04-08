// Definiendo los tipos de unidades permitidas
export type UnitType = "MTS" | "KGS";

// Definiendo los roles de usuario permitidos
export type UserRole = "admin" | "sales";

// Definiendo la estructura de un ítem de inventario
export interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: UnitType;
  Total: number;
  Importacion: "DA" | "HOY";
  FacturaDragonAzteca: string;
}

// Definiendo la estructura de un usuario
export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
}

// Definiendo la estructura para sesión de usuario
export interface UserSession {
  user: User;
  token: string;
  expiresAt: number;
}

// Definición para las credenciales de usuario
export interface UserCredentials {
  username: string;
  password: string;
}
