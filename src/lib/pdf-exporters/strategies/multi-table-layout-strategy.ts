import jsPDF from 'jspdf';
import { LayoutStrategy, PageConfiguration, TableSegment } from '@/types/pdf-export';

export class MultiTableLayoutStrategy implements LayoutStrategy {
  private readonly pageConfig: PageConfiguration = {
    format: 'a3',
    orientation: 'landscape',
    margins: { top: 20, right: 8, bottom: 20, left: 8 },
    maxContentWidth: 404, // A3 landscape - margins
    maxContentHeight: 277  // A3 landscape - margins (más espacio para múltiples tablas)
  };

  private readonly segmentSize = 6; // Máximo 6 proveedores por tabla

  formatPage(pdf: jsPDF): void {
    pdf.setPage(1);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
  }

  calculateColumnWidths(providerCount: number, maxContentWidth: number): number[] {
    // Para segmentos de 6 proveedores, optimizado para múltiples tablas - Solo Nombre + Fecha
    const effectiveProviderCount = Math.min(providerCount, this.segmentSize);
    const baseColumns = 64; // Nombre + Fecha (más ancho para claridad)
    const availableWidth = maxContentWidth - baseColumns;
    const providerWidth = Math.max(32, availableWidth / effectiveProviderCount);
    
    const widths = [44, 20]; // Nombre, Fecha
    for (let i = 0; i < effectiveProviderCount; i++) {
      widths.push(providerWidth);
    }
    
    return widths;
  }

  configureFont(pdf: jsPDF): void {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
  }

  getTableOptions(): Record<string, unknown> {
    return {
      startY: 40,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: 'middle',
        halign: 'center',
        lineColor: [170, 170, 170],
        lineWidth: 0.4
      },
      headStyles: {
        fillColor: [40, 96, 144],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 8,
        alternateRowStyles: {
          fillColor: [252, 253, 254]
        }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 44 },   // Nombre
        1: { halign: 'center', cellWidth: 20 }  // Fecha
      },
      margin: { top: 40, left: 8, right: 8 },
      pageBreak: 'avoid', // Evitar breaks dentro de una tabla
      showHead: 'everyPage',
      tableLineColor: [170, 170, 170],
      tableLineWidth: 0.4
    };
  }

  shouldSegmentTable(providerCount?: number): boolean {
    return (providerCount || 0) > 8; // MultiTableLayout siempre segmenta para 9+
  }

  getSegmentSize(): number {
    return this.segmentSize;
  }

  createTableSegments(providers: string[]): TableSegment[] {
    const segments: TableSegment[] = [];
    
    for (let i = 0; i < providers.length; i += this.segmentSize) {
      const endIndex = Math.min(i + this.segmentSize, providers.length);
      segments.push({
        providers: providers.slice(i, endIndex),
        startIndex: i,
        endIndex: endIndex - 1
      });
    }
    
    return segments;
  }

  addHeader(pdf: jsPDF, title: string, subtitle?: string, segmentInfo?: { current: number; total: number; providers: string[] }): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Título principal
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(41, 49, 58);
    
    let mainTitle = title;
    if (segmentInfo) {
      mainTitle = `${title} - Grupo ${segmentInfo.current} de ${segmentInfo.total}`;
    }
    
    const titleWidth = pdf.getTextWidth(mainTitle);
    const titleX = (pageWidth - titleWidth) / 2;
    pdf.text(mainTitle, titleX, 22);

    // Subtítulo con información del segmento
    if (segmentInfo) {
      const providerList = segmentInfo.providers.join(', ');
      const segmentSubtitle = `Proveedores: ${providerList}`;
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(82, 98, 114);
      
      // Dividir en múltiples líneas si es muy largo
      const maxWidth = pageWidth - 40;
      const lines = pdf.splitTextToSize(segmentSubtitle, maxWidth);
      
      let currentY = 31;
      lines.forEach((line: string) => {
        const lineWidth = pdf.getTextWidth(line);
        const lineX = (pageWidth - lineWidth) / 2;
        pdf.text(line, lineX, currentY);
        currentY += 6;
      });
    } else if (subtitle) {
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(82, 98, 114);
      
      const subtitleWidth = pdf.getTextWidth(subtitle);
      const subtitleX = (pageWidth - subtitleWidth) / 2;
      pdf.text(subtitle, subtitleX, 31);
    }

    // Fecha de generación
    const currentDate = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(108, 117, 125);
    pdf.text(`Generado el: ${currentDate}`, 8, 10);

    // Información de formato
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(108, 117, 125);
    pdf.text('Formato: A3 - Vista Multi-Tabla', pageWidth - 100, 10);
  }

  addFooter(pdf: jsPDF, pageNumber: number, totalPages: number, segmentInfo?: { current: number; total: number }): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(108, 117, 125);
    
    // Línea superior
    pdf.setDrawColor(170, 170, 170);
    pdf.setLineWidth(0.5);
    pdf.line(8, pageHeight - 25, pageWidth - 8, pageHeight - 25);
    
    // Número de página y segmento centrado
    let pageText = `Página ${pageNumber} de ${totalPages}`;
    if (segmentInfo) {
      pageText += ` | Grupo ${segmentInfo.current} de ${segmentInfo.total}`;
    }
    
    const pageTextWidth = pdf.getTextWidth(pageText);
    const pageTextX = (pageWidth - pageTextWidth) / 2;
    pdf.text(pageText, pageTextX, pageHeight - 8);
    
    // Información de la empresa (izquierda)
    pdf.text('Telas y Tejidos Luciana', 8, pageHeight - 8);
    
    // Tipo de reporte (derecha)
    pdf.text('Comparativa Multi-Tabla', pageWidth - 90, pageHeight - 8);
    
    // Información adicional centrada
    const infoText = 'Los datos están segmentados por grupos de proveedores para mayor claridad';
    const infoTextWidth = pdf.getTextWidth(infoText);
    const infoTextX = (pageWidth - infoTextWidth) / 2;
    pdf.text(infoText, infoTextX, pageHeight - 15);
  }

  addSegmentSeparator(pdf: jsPDF, segmentNumber: number, totalSegments: number): void {
    // Agregar una nueva página para cada segmento (excepto el primero)
    if (segmentNumber > 1) {
      pdf.addPage();
    }
    
    // Opcional: agregar una línea separadora visual si están en la misma página
    const pageWidth = pdf.internal.pageSize.getWidth();
    const currentY = (pdf as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 40;
    
    if (currentY + 100 < pdf.internal.pageSize.getHeight()) {
      // Hay espacio para otra tabla en la misma página
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(1);
      pdf.line(20, currentY + 10, pageWidth - 20, currentY + 10);
      
      // Texto indicativo
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(108, 117, 125);
      
      const separatorText = `--- Grupo ${segmentNumber} de ${totalSegments} ---`;
      const separatorWidth = pdf.getTextWidth(separatorText);
      const separatorX = (pageWidth - separatorWidth) / 2;
      pdf.text(separatorText, separatorX, currentY + 20);
    }
  }

  getPageConfiguration(): PageConfiguration {
    return this.pageConfig;
  }

  validateData(data: Record<string, unknown>[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Array.isArray(data) || data.length === 0) {
      errors.push('No hay datos para exportar');
      return { isValid: false, errors };
    }

    // Validar número de proveedores para esta estrategia
    const firstRow = data[0];
    const providerCount = Object.keys(firstRow).length - 2; // Excluyendo nombre y fecha
    
    if (providerCount <= 8) {
      errors.push(`Pocos proveedores (${providerCount}) para vista multi-tabla. Se recomienda vista estándar o compacta`);
    }

    // Validar estructura de datos
    data.forEach((row, index) => {
      if (!row.nombre) {
        errors.push(`Fila ${index + 1}: falta nombre del tejido`);
      }
    });

    // Validar que hay suficientes datos para justificar múltiples tablas
    if (data.length < 10) {
      errors.push('Muy pocos tejidos para justificar vista multi-tabla. Considere otra vista');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  estimatePages(dataLength: number, providerCount: number): number {
    const segments = Math.ceil(providerCount / this.segmentSize);
    const rowsPerPage = 25; // Estimación conservadora para A3
    const pagesPerSegment = Math.ceil(dataLength / rowsPerPage);
    
    return segments * pagesPerSegment;
  }

  optimizeSegmentDistribution(providers: string[]): string[] {
    // Redistribuir proveedores para optimizar el uso del espacio
    // Priorizar proveedores con más datos o más importantes
    return providers.sort((a, b) => {
      // Por ahora, orden alfabético. Posteriormente se puede mejorar
      // basándose en frecuencia de datos o importancia del proveedor
      return a.localeCompare(b, 'es');
    });
  }
}