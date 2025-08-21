import jsPDF from 'jspdf';

export interface LayoutStrategy {
  formatPage(pdf: jsPDF): void;
  calculateColumnWidths(providerCount: number, maxContentWidth: number): number[];
  configureFont(pdf: jsPDF): void;
  getTableOptions(pageSize: string): Record<string, unknown>;
  shouldSegmentTable(providerCount: number): boolean;
  getSegmentSize(): number;
  addHeader(pdf: jsPDF, title: string, subtitle?: string, segmentInfo?: Record<string, unknown>): void;
  addFooter(pdf: jsPDF, pageNumber: number, totalPages: number, segmentInfo?: Record<string, unknown>): void;
  getPageConfiguration(): PageConfiguration;
  validateData(data: Record<string, unknown>[]): { isValid: boolean; errors: string[] };
}

export interface PageConfiguration {
  format: string;
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  maxContentWidth: number;
  maxContentHeight: number;
}

export interface TableSegment {
  providers: string[];
  startIndex: number;
  endIndex: number;
}

export interface PDFExportConfig {
  title: string;
  subtitle?: string;
  showHeaders: boolean;
  showFooters: boolean;
  dateFormat: string;
  currency: string;
}

export interface ProviderMatrixData {
  fabricName: string;
  fabricCode: string;
  providers: {
    [providerName: string]: {
      price?: number;
      date?: string;
      available: boolean;
    };
  };
}

export interface ExportResult {
  success: boolean;
  fileName?: string;
  error?: string;
  pages?: number;
  segments?: number;
}

export type LayoutStrategyType = 'compact' | 'standard' | 'multi-table';

export interface StrategySelection {
  type: LayoutStrategyType;
  reason: string;
  providerCount: number;
  expectedPages: number;
}

// Types for traditional PDF export
export interface PDFHeader {
  title: string;
  subtitle?: string;
  date: string;
}

export interface PDFFooter {
  leftText?: string;
  centerText?: string;
  rightText?: string;
}

export interface PDFExportOptions {
  filename: string;
  header: PDFHeader;
  footer?: PDFFooter;
}

export interface TraditionalExportData {
  fabrics: {
    nombre: string;
    precioMin: string;
    precioMax: string;
    precioPromedio: string;
    unidad: string;
  }[];
}

export abstract class PDFExporter {
  protected config = {
    orientation: 'landscape' as const,
    format: 'a4' as const,
    margin: 15,
    fontSize: {
      title: 18,
      subtitle: 14,
      header: 10,
      body: 9,
      footer: 8,
    },
    colors: {
      primary: [0, 0, 0] as [number, number, number],
      secondary: [100, 100, 100] as [number, number, number],
      background: [240, 240, 240] as [number, number, number],
      border: [200, 200, 200] as [number, number, number],
    },
  };

  protected formatPrice(price: number): string {
    return `$${price.toFixed(2)}`;
  }

  abstract export(data: unknown, options: unknown): Promise<void>;
}