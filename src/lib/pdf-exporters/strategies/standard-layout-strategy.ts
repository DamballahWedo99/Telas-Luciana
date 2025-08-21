import jsPDF from 'jspdf';
import { LayoutStrategy, PageConfiguration } from '@/types/pdf-export';

export class StandardLayoutStrategy implements LayoutStrategy {
  private readonly pageConfig: PageConfiguration = {
    format: 'a3',
    orientation: 'landscape',
    margins: { top: 15, right: 8, bottom: 15, left: 8 },
    maxContentWidth: 404, // A3 landscape - margins
    maxContentHeight: 282  // A3 landscape - margins
  };

  formatPage(pdf: jsPDF): void {
    pdf.setPage(1);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
  }

  calculateColumnWidths(providerCount: number, maxContentWidth: number): number[] {
    // Para 5-8 proveedores, columnas más compactas - Solo Nombre + Fecha
    const baseColumns = 60; // Nombre + Fecha (más ancho en A3)
    const availableWidth = maxContentWidth - baseColumns;
    const providerWidth = Math.max(28, availableWidth / providerCount);
    
    const widths = [40, 20]; // Nombre, Fecha
    for (let i = 0; i < providerCount; i++) {
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
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: 'middle',
        halign: 'center',
        lineColor: [180, 180, 180],
        lineWidth: 0.3
      },
      headStyles: {
        fillColor: [52, 119, 182],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 8,
        alternateRowStyles: {
          fillColor: [250, 251, 252]
        }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 40 },   // Nombre
        1: { halign: 'center', cellWidth: 20 }  // Fecha
      },
      margin: { top: 35, left: 8, right: 8 },
      pageBreak: 'auto',
      showHead: 'everyPage',
      tableLineColor: [180, 180, 180],
      tableLineWidth: 0.3
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldSegmentTable(providerCount?: number): boolean {
    return false; // StandardLayout maneja hasta 8 proveedores sin segmentar
  }

  getSegmentSize(): number {
    return 0; // No aplica para esta estrategia
  }

  addHeader(pdf: jsPDF, title: string, subtitle?: string): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Título principal
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(41, 49, 58);
    
    const titleWidth = pdf.getTextWidth(title);
    const titleX = (pageWidth - titleWidth) / 2;
    pdf.text(title, titleX, 22);

    // Subtítulo si existe
    if (subtitle) {
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

    // Información adicional en A3
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(108, 117, 125);
    pdf.text('Formato: A3 - Vista Estándar', pageWidth - 80, 10);
  }

  addFooter(pdf: jsPDF, pageNumber: number, totalPages: number): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(108, 117, 125);
    
    // Línea superior
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.5);
    pdf.line(8, pageHeight - 20, pageWidth - 8, pageHeight - 20);
    
    // Número de página centrado
    const pageText = `Página ${pageNumber} de ${totalPages}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    const pageTextX = (pageWidth - pageTextWidth) / 2;
    pdf.text(pageText, pageTextX, pageHeight - 8);
    
    // Información de la empresa (izquierda)
    pdf.text('Telas y Tejidos Luciana', 8, pageHeight - 8);
    
    // Tipo de reporte (derecha)
    pdf.text('Comparativa de Proveedores', pageWidth - 80, pageHeight - 8);
    
    // Información adicional centrada
    const infoText = 'Documento generado automáticamente - Precios sujetos a cambios';
    const infoTextWidth = pdf.getTextWidth(infoText);
    const infoTextX = (pageWidth - infoTextWidth) / 2;
    pdf.text(infoText, infoTextX, pageHeight - 15);
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
    
    if (providerCount > 8) {
      errors.push(`Demasiados proveedores (${providerCount}) para vista estándar. Máximo recomendado: 8`);
    }

    if (providerCount < 5) {
      errors.push(`Pocos proveedores (${providerCount}) para vista estándar. Se recomienda vista compacta`);
    }

    // Validar estructura de datos
    data.forEach((row, index) => {
      if (!row.nombre) {
        errors.push(`Fila ${index + 1}: falta nombre del tejido`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  optimizeForPerformance(data: Record<string, unknown>[]): Record<string, unknown>[] {
    // Para StandardLayout, aplicamos algunas optimizaciones
    return data.map(row => {
      const optimizedRow = { ...row };
      
      // Truncar nombres muy largos para mantener el layout
      if (optimizedRow.nombre && typeof optimizedRow.nombre === 'string' && optimizedRow.nombre.length > 25) {
        optimizedRow.nombre = optimizedRow.nombre.substring(0, 22) + '...';
      }
      
      // No hay códigos para formatear en la nueva estructura
      
      return optimizedRow;
    });
  }
}