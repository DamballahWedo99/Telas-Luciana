import { 
  ExportResult, 
  PDFExportConfig, 
  StrategySelection,
  PDFExportOptions
} from '@/types/pdf-export';
import { MultiProviderTableData, PriceHistoryResponse } from '@/types/price-history';
import { ProviderMatrixPDFExporter } from './pdf-exporters/provider-matrix-pdf-exporter';
import { TraditionalPDFExporter } from './pdf-exporters/traditional-pdf-exporter';

export class PDFExportService {
  private static instance: PDFExportService;
  private readonly defaultConfig: PDFExportConfig;

  private constructor() {
    this.defaultConfig = {
      title: 'Historial de Precios - Telas y Tejidos Luciana',
      subtitle: '',
      showHeaders: true,
      showFooters: true,
      dateFormat: 'es-ES',
      currency: '$'
    };
  }

  public static getInstance(): PDFExportService {
    if (!PDFExportService.instance) {
      PDFExportService.instance = new PDFExportService();
    }
    return PDFExportService.instance;
  }

  /**
   * Crear configuración personalizada
   */
  private createExportConfig(customConfig?: Partial<PDFExportConfig>): PDFExportConfig {
    return { ...this.defaultConfig, ...customConfig };
  }

  /**
   * Generar nombre de archivo por defecto
   */
  private generateDefaultFilename(type: 'traditional' | 'provider-matrix' = 'provider-matrix'): string {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
    const prefix = type === 'traditional' ? 'historial-tradicional' : 'comparativa-proveedores';
    return `${prefix}-${timestamp}.pdf`;
  }

  /**
   * Exportar matriz de proveedores con estrategia automática
   */
  public async exportProviderMatrix(
    data: MultiProviderTableData,
    filename?: string,
    config?: Partial<PDFExportConfig>,
    filterFabricId?: string
  ): Promise<ExportResult> {
    try {
      // Validar datos
      this.validateProviderMatrixData(data);

      // Crear exportador con configuración
      const exporterConfig = this.createExportConfig(config);
      const exporter = new ProviderMatrixPDFExporter(exporterConfig);

      // Ejecutar exportación
      const result = await exporter.export(data, filename, filterFabricId);

      return result;

    } catch (error) {
      console.error('Error en exportación PDF de matriz de proveedores:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al exportar PDF'
      };
    }
  }

  /**
   * Exportar historial tradicional de precios
   */
  public async exportTraditional(
    data: PriceHistoryResponse,
    options?: PDFExportOptions
  ): Promise<ExportResult> {
    try {
      // Validar datos
      this.validateTraditionalData(data);

      // Crear opciones de exportación por defecto si no se proporcionan
      const exportOptions: PDFExportOptions = options || {
        filename: this.generateDefaultFilename('traditional'),
        header: {
          title: 'Historial de Precios - Telas y Tejidos Luciana',
          subtitle: 'Resumen Tradicional de Precios',
          date: new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }
      };

      // Crear y ejecutar exportador tradicional
      const exporter = new TraditionalPDFExporter();
      await exporter.export(data, exportOptions);

      return {
        success: true,
        fileName: exportOptions.filename,
        pages: 1 // Por simplicidad, asumimos 1 página por ahora
      };

    } catch (error) {
      console.error('Error en exportación PDF tradicional:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al exportar PDF'
      };
    }
  }

  /**
   * Obtener información sobre la estrategia que se usaría
   */
  public getStrategyInfo(data: MultiProviderTableData): StrategySelection | null {
    try {
      this.validateProviderMatrixData(data);
      const exporter = new ProviderMatrixPDFExporter();
      const providerCount = data.providers.length;
      return exporter.getStrategyInfo(providerCount);
    } catch (error) {
      console.error('Error al obtener información de estrategia:', error);
      return null;
    }
  }

  /**
   * Validar datos antes de exportar
   */
  public validateExportData(data: MultiProviderTableData): { isValid: boolean; errors: string[]; warnings: string[] } {
    try {
      const exporter = new ProviderMatrixPDFExporter();
      return exporter.validateData(data);
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Error de validación desconocido'],
        warnings: []
      };
    }
  }

  /**
   * Validar datos específicos para matriz de proveedores
   */
  private validateProviderMatrixData(data: MultiProviderTableData): void {
    if (!data) {
      throw new Error('No se proporcionaron datos para exportar');
    }

    if (!data.fabrics || !Array.isArray(data.fabrics)) {
      throw new Error('Datos inválidos: falta array de fabrics');
    }

    if (!data.providers || !Array.isArray(data.providers)) {
      throw new Error('Datos inválidos: falta array de providers');
    }

    if (data.fabrics.length === 0) {
      throw new Error('No hay datos de telas para exportar');
    }

    if (data.providers.length === 0) {
      throw new Error('No hay datos de proveedores para exportar');
    }

    // Validar que los providers tengan la estructura correcta
    data.providers.forEach((provider, index) => {
      if (!provider.name || typeof provider.name !== 'string') {
        throw new Error(`Proveedor ${index + 1}: falta nombre válido`);
      }
    });

    // Validar que las telas tengan la estructura correcta
    data.fabrics.forEach((fabric, index) => {
      if (!fabric.fabricId) {
        throw new Error(`Tela ${index + 1}: falta fabricId`);
      }
      if (!fabric.fabricName) {
        throw new Error(`Tela ${index + 1}: falta fabricName`);
      }
    });
  }

  /**
   * Validar datos específicos para exportación tradicional
   */
  private validateTraditionalData(data: PriceHistoryResponse): void {
    if (!data) {
      throw new Error('No se proporcionaron datos para exportar');
    }

    if (!data.fabrics || !Array.isArray(data.fabrics)) {
      throw new Error('Datos inválidos: falta array de fabrics');
    }

    if (!data.summary || !Array.isArray(data.summary)) {
      throw new Error('Datos inválidos: falta array de summary');
    }

    if (data.fabrics.length === 0) {
      throw new Error('No hay datos de telas para exportar');
    }

    // Validar que las telas tengan la estructura correcta
    data.fabrics.forEach((fabric, index) => {
      if (!fabric.fabricId) {
        throw new Error(`Tela ${index + 1}: falta fabricId`);
      }
      if (!fabric.fabricName) {
        throw new Error(`Tela ${index + 1}: falta fabricName`);
      }
    });

    // Validar que el summary tenga la estructura correcta
    data.summary.forEach((summary, index) => {
      if (!summary.fabricId) {
        throw new Error(`Summary ${index + 1}: falta fabricId`);
      }
      if (typeof summary.minPrice !== 'number') {
        throw new Error(`Summary ${index + 1}: precio mínimo inválido`);
      }
      if (typeof summary.maxPrice !== 'number') {
        throw new Error(`Summary ${index + 1}: precio máximo inválido`);
      }
      if (typeof summary.avgPrice !== 'number') {
        throw new Error(`Summary ${index + 1}: precio promedio inválido`);
      }
    });
  }

  /**
   * Obtener configuración por defecto
   */
  public getDefaultConfig(): PDFExportConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Crear una instancia del servicio con configuración personalizada
   */
  public static createWithConfig(config: Partial<PDFExportConfig>): PDFExportService {
    const service = PDFExportService.getInstance();
    // Crear una nueva instancia temporal con configuración personalizada
    const customService = Object.create(service);
    customService.defaultConfig = { ...service.defaultConfig, ...config };
    return customService;
  }
}