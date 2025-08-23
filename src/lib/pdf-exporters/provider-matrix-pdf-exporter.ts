import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LayoutStrategy, LayoutStrategyType, StrategySelection, ExportResult, PDFExportConfig } from '@/types/pdf-export';
import { CompactLayoutStrategy } from './strategies/compact-layout-strategy';
import { StandardLayoutStrategy } from './strategies/standard-layout-strategy';
import { MultiTableLayoutStrategy } from './strategies/multi-table-layout-strategy';
import { MultiProviderTableData, ProviderPriceData } from '@/types/price-history';

export class ProviderMatrixPDFExporter {
  private strategy!: LayoutStrategy;
  private config: PDFExportConfig = {
    title: 'Comparativa de Proveedores',
    subtitle: '',
    showHeaders: true,
    showFooters: true,
    dateFormat: 'es-ES',
    currency: '$'
  };

  constructor(config?: Partial<PDFExportConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async export(data: MultiProviderTableData, filename?: string, filterFabricId?: string, selectedProviders?: string[]): Promise<ExportResult> {
    try {
      // Aplicar filtro por tela específica si se proporciona
      let filteredData = data;
      if (filterFabricId) {
        filteredData = {
          ...data,
          fabrics: data.fabrics.filter(fabric => fabric.fabricId === filterFabricId)
        };
        
        if (filteredData.fabrics.length === 0) {
          return {
            success: false,
            error: `No se encontró la tela con ID: ${filterFabricId}`
          };
        }
      }

      // Aplicar filtro de proveedores si se proporciona
      // Si selectedProviders está vacío o undefined, incluir todos los proveedores
      if (selectedProviders && selectedProviders.length > 0) {
        // Filtrar proveedores en los datos
        filteredData = {
          ...filteredData,
          providers: filteredData.providers.filter(provider => 
            selectedProviders.includes(provider.id)
          ),
          // También filtrar los datos de proveedores en cada tela
          fabrics: filteredData.fabrics.map(fabric => ({
            ...fabric,
            providers: Object.keys(fabric.providers).reduce((acc, providerId) => {
              if (selectedProviders.includes(providerId)) {
                acc[providerId] = fabric.providers[providerId];
              }
              return acc;
            }, {} as Record<string, ProviderPriceData | null>)
          }))
        };
        
        if (filteredData.providers.length === 0) {
          return {
            success: false,
            error: 'No se encontraron proveedores seleccionados'
          };
        }
      }

      // Validar datos de entrada
      const validation = this.validateInputData(filteredData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Datos inválidos: ${validation.errors.join(', ')}`
        };
      }

      // Preparar datos para exportación
      const preparedData = this.prepareTableData(filteredData);
      const providers = Object.keys(preparedData[0] || {}).filter(key => 
        key !== 'nombre' && key !== 'fecha'
      );
      
      // Seleccionar estrategia automáticamente
      const strategySelection = this.selectStrategy(providers.length);
      this.strategy = this.createStrategy(strategySelection.type);

      // Validar datos con la estrategia seleccionada
      const strategyValidation = this.strategy.validateData(preparedData);
      if (!strategyValidation.isValid) {
        console.warn('Advertencias de estrategia:', strategyValidation.errors);
      }

      // Configurar PDF
      const pageConfig = this.strategy.getPageConfiguration();
      const doc = new jsPDF({
        orientation: pageConfig.orientation,
        unit: 'mm',
        format: pageConfig.format
      });

      let totalPages = 0;
      let segments = 1;

      // Verificar si necesitamos segmentación
      if (this.strategy.shouldSegmentTable(providers.length)) {
        const result = await this.exportMultiTable(doc, preparedData, providers);
        totalPages = result.pages;
        segments = result.segments;
      } else {
        totalPages = await this.exportSingleTable(doc, preparedData, providers);
      }

      // Guardar archivo
      const finalFilename = filename || this.generateFilename();
      doc.save(finalFilename);

      return {
        success: true,
        fileName: finalFilename,
        pages: totalPages,
        segments
      };

    } catch (error) {
      console.error('Error al exportar PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al exportar PDF'
      };
    }
  }

  // Strategy Pattern Factory Method
  private selectStrategy(providerCount: number): StrategySelection {
    if (providerCount <= 4) {
      return {
        type: 'compact',
        reason: 'Pocos proveedores: diseño compacto en A4 landscape',
        providerCount,
        expectedPages: 1
      };
    } else if (providerCount <= 8) {
      return {
        type: 'standard',
        reason: 'Número moderado de proveedores: diseño estándar en A3 landscape',
        providerCount,
        expectedPages: 1
      };
    } else {
      const segments = Math.ceil(providerCount / 6);
      return {
        type: 'multi-table',
        reason: 'Muchos proveedores: segmentación en múltiples tablas',
        providerCount,
        expectedPages: segments
      };
    }
  }

  private createStrategy(type: LayoutStrategyType): LayoutStrategy {
    switch (type) {
      case 'compact':
        return new CompactLayoutStrategy();
      case 'standard':
        return new StandardLayoutStrategy();
      case 'multi-table':
        return new MultiTableLayoutStrategy();
      default:
        throw new Error(`Estrategia de layout desconocida: ${type}`);
    }
  }

  private validateInputData(data: MultiProviderTableData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data) {
      errors.push('No se proporcionaron datos');
      return { isValid: false, errors };
    }

    if (!data.fabrics || !Array.isArray(data.fabrics) || data.fabrics.length === 0) {
      errors.push('No hay tejidos para exportar');
    }

    if (!data.providers || !Array.isArray(data.providers) || data.providers.length === 0) {
      errors.push('No hay proveedores para comparar');
    }

    if (data.providers && data.providers.length > 20) {
      errors.push('Demasiados proveedores (máximo recomendado: 20)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private prepareTableData(data: MultiProviderTableData): Record<string, unknown>[] {
    const providers = data.providers.map(p => p.name);
    const rows: Record<string, unknown>[] = [];
    
    // Para cada fabric, extraer todas las entradas históricas
    data.fabrics.forEach(fabric => {
      // Obtener todas las entradas históricas únicas de todos los proveedores
      const allHistoricalEntries: Array<{
        fabricId: string;
        fabricName: string;
        provider: string;
        date: string;
        price: number;
        unit: string;
      }> = [];
      
      // Recopilar todas las entradas de todos los proveedores para este fabric
      providers.forEach(provider => {
        const providerData = fabric.providers?.[provider];
        if (providerData && providerData.allEntries) {
          providerData.allEntries.forEach(entry => {
            allHistoricalEntries.push({
              fabricId: fabric.fabricId,
              fabricName: fabric.fabricName,
              provider: provider,
              date: entry.date,
              price: entry.quantity, // quantity contiene el precio
              unit: entry.unit || 'kg'
            });
          });
        }
      });
      
      // Si no hay entradas históricas, crear una fila con solo la información básica
      if (allHistoricalEntries.length === 0) {
        const row: Record<string, unknown> = {
          nombre: fabric.fabricName || 'Sin nombre',
          fecha: '',
        };
        
        providers.forEach(provider => {
          row[provider] = 'N/A';
        });
        
        rows.push(row);
        return;
      }
      
      // Ordenar entradas por fecha (más reciente primero) y luego por proveedor
      allHistoricalEntries.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        
        return a.provider.localeCompare(b.provider);
      });
      
      // Crear una fila por cada entrada histórica
      allHistoricalEntries.forEach(entry => {
        const row: Record<string, unknown> = {
          nombre: entry.fabricName || 'Sin nombre',
          fecha: this.formatDate(entry.date),
        };
        
        // Inicializar todas las columnas de proveedores como N/A
        providers.forEach(provider => {
          row[provider] = 'N/A';
        });
        
        // Llenar solo la columna del proveedor correspondiente
        const formattedPrice = this.formatPrice(entry.price);
        row[entry.provider] = `${this.config.currency}${formattedPrice} (${entry.unit})`;
        
        rows.push(row);
      });
    });
    
    return rows;
  }

  private async exportSingleTable(doc: jsPDF, data: Record<string, unknown>[], providers: string[]): Promise<number> {
    // Configurar estrategia
    this.strategy.formatPage(doc);
    
    // Agregar header
    if (this.config.showHeaders) {
      this.strategy.addHeader(doc, this.config.title, this.config.subtitle);
    }

    // Configurar fuentes
    this.strategy.configureFont(doc);

    // Calcular anchos de columna
    const pageConfig = this.strategy.getPageConfiguration();
    const columnWidths = this.strategy.calculateColumnWidths(providers.length, pageConfig.maxContentWidth);

    // Construir columnas
    const columns = [
      { header: 'Nombre', dataKey: 'nombre' },
      { header: 'Fecha', dataKey: 'fecha' },
      ...providers.map(provider => ({
        header: provider,
        dataKey: provider,
      })),
    ];

    // Configurar estilos de columna
    const columnStyles: Record<string, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {
      nombre: { cellWidth: columnWidths[0], halign: 'left' },
      fecha: { cellWidth: columnWidths[1], halign: 'center' },
    };

    providers.forEach((provider, index) => {
      columnStyles[provider] = {
        cellWidth: columnWidths[index + 2], // +2 porque ahora tenemos 2 columnas base
        halign: 'center'
      };
    });

    // Obtener opciones de tabla de la estrategia
    const tableOptions = this.strategy.getTableOptions();

    // Aplicar configuración personalizada
    autoTable(doc, {
      ...tableOptions,
      columns,
      body: data as unknown as (string | number)[][],
      columnStyles,
      didDrawPage: (pageData) => {
        if (this.config.showFooters) {
          this.strategy.addFooter(doc, pageData.pageNumber, doc.getNumberOfPages());
        }
      }
    });

    return doc.getNumberOfPages();
  }

  private async exportMultiTable(doc: jsPDF, data: Record<string, unknown>[], providers: string[]): Promise<{ pages: number; segments: number }> {
    if (!(this.strategy instanceof MultiTableLayoutStrategy)) {
      throw new Error('MultiTableLayoutStrategy requerida para exportación multi-tabla');
    }

    // Crear segmentos de proveedores
    const segments = this.strategy.createTableSegments(providers);

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      
      // Agregar separador si no es el primer segmento
      if (segmentIndex > 0) {
        this.strategy.addSegmentSeparator(doc, segmentIndex + 1, segments.length);
      }

      // Configurar página para este segmento
      this.strategy.formatPage(doc);

      // Agregar header específico del segmento
      if (this.config.showHeaders) {
        this.strategy.addHeader(
          doc, 
          this.config.title, 
          this.config.subtitle,
          {
            current: segmentIndex + 1,
            total: segments.length,
            providers: segment.providers
          }
        );
      }

      // Configurar fuentes
      this.strategy.configureFont(doc);

      // Preparar datos para este segmento
      const segmentData = data.map(row => {
        const segmentRow: Record<string, unknown> = {
          nombre: row.nombre,
          fecha: row.fecha
        };
        
        segment.providers.forEach(provider => {
          segmentRow[provider] = row[provider];
        });
        
        return segmentRow;
      });

      // Calcular anchos de columna para este segmento
      const pageConfig = this.strategy.getPageConfiguration();
      const columnWidths = this.strategy.calculateColumnWidths(segment.providers.length, pageConfig.maxContentWidth);

      // Construir columnas para este segmento
      const columns = [
        { header: 'Nombre', dataKey: 'nombre' },
        { header: 'Fecha', dataKey: 'fecha' },
        ...segment.providers.map(provider => ({
          header: provider,
          dataKey: provider,
        })),
      ];

      // Configurar estilos de columna
      const columnStyles: Record<string, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {
        nombre: { cellWidth: columnWidths[0], halign: 'left' },
        fecha: { cellWidth: columnWidths[1], halign: 'center' },
      };

      segment.providers.forEach((provider, index) => {
        columnStyles[provider] = {
          cellWidth: columnWidths[index + 2], // +2 porque ahora tenemos 2 columnas base
          halign: 'center'
        };
      });

      // Obtener opciones de tabla
      const tableOptions = this.strategy.getTableOptions();

      // Aplicar configuración personalizada para este segmento
      autoTable(doc, {
        ...tableOptions,
        columns,
        body: segmentData as unknown as (string | number)[][],
        columnStyles,
        didDrawPage: (pageData) => {
          if (this.config.showFooters) {
            this.strategy.addFooter(
              doc, 
              pageData.pageNumber, 
              doc.getNumberOfPages(),
              {
                current: segmentIndex + 1,
                total: segments.length
              }
            );
          }
        }
      });

      // Agregar nueva página para el siguiente segmento (si no es el último)
      if (segmentIndex < segments.length - 1) {
        doc.addPage();
      }
    }

    return {
      pages: doc.getNumberOfPages(),
      segments: segments.length
    };
  }

  private formatPrice(price: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  private generateFilename(): string {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
    return `comparativa-proveedores-${timestamp}.pdf`;
  }

  // Método público para obtener información de la estrategia seleccionada
  public getStrategyInfo(providerCount: number): StrategySelection {
    return this.selectStrategy(providerCount);
  }

  // Método público para validar datos antes de exportar
  public validateData(data: MultiProviderTableData): { isValid: boolean; errors: string[]; warnings: string[] } {
    const baseValidation = this.validateInputData(data);
    
    if (!baseValidation.isValid) {
      return {
        ...baseValidation,
        warnings: []
      };
    }

    const preparedData = this.prepareTableData(data);
    const providers = Object.keys(preparedData[0] || {}).filter(key => 
      key !== 'nombre' && key !== 'fecha'
    );
    
    const strategySelection = this.selectStrategy(providers.length);
    const strategy = this.createStrategy(strategySelection.type);
    const strategyValidation = strategy.validateData(preparedData);

    return {
      isValid: baseValidation.isValid && strategyValidation.isValid,
      errors: [...baseValidation.errors, ...strategyValidation.errors],
      warnings: strategyValidation.isValid ? [] : strategyValidation.errors
    };
  }
}