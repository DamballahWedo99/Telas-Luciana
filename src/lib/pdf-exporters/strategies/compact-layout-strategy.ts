import jsPDF from 'jspdf';
import { LayoutStrategy, PageConfiguration } from '@/types/pdf-export';

export class CompactLayoutStrategy implements LayoutStrategy {
  private readonly pageConfig: PageConfiguration = {
    format: 'a4',
    orientation: 'landscape',
    margins: { top: 15, right: 10, bottom: 15, left: 10 },
    maxContentWidth: 277, // A4 landscape - margins
    maxContentHeight: 180  // A4 landscape - margins
  };

  formatPage(pdf: jsPDF): void {
    pdf.setPage(1);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
  }

  calculateColumnWidths(providerCount: number, maxContentWidth: number): number[] {
    // Para 1-4 proveedores, columnas generosas - Solo Nombre + Fecha
    const baseColumns = 55; // Nombre + Fecha
    const availableWidth = maxContentWidth - baseColumns;
    const providerWidth = Math.max(35, availableWidth / providerCount);
    
    const widths = [35, 20]; // Nombre, Fecha
    for (let i = 0; i < providerCount; i++) {
      widths.push(providerWidth);
    }
    
    return widths;
  }

  configureFont(pdf: jsPDF): void {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
  }

  getTableOptions(): Record<string, unknown> {
    return {
      startY: 30,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle',
        halign: 'center',
        lineColor: [200, 200, 200],
        lineWidth: 0.5
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        }
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 35 },   // Nombre
        1: { halign: 'center', cellWidth: 20 }  // Fecha
      },
      margin: { top: 30, left: 10, right: 10 },
      pageBreak: 'auto',
      showHead: 'everyPage',
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.5
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldSegmentTable(providerCount?: number): boolean {
    return false; // CompactLayout nunca segmenta
  }

  getSegmentSize(): number {
    return 0; // No aplica para esta estrategia
  }

  addHeader(pdf: jsPDF, title: string, subtitle?: string): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Título principal
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(51, 51, 51);
    
    const titleWidth = pdf.getTextWidth(title);
    const titleX = (pageWidth - titleWidth) / 2;
    pdf.text(title, titleX, 20);

    // Subtítulo si existe
    if (subtitle) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(102, 102, 102);
      
      const subtitleWidth = pdf.getTextWidth(subtitle);
      const subtitleX = (pageWidth - subtitleWidth) / 2;
      pdf.text(subtitle, subtitleX, 28);
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
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Generado el: ${currentDate}`, 10, 10);
  }

  addFooter(pdf: jsPDF, pageNumber: number, totalPages: number): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(128, 128, 128);
    
    // Número de página centrado
    const pageText = `Página ${pageNumber} de ${totalPages}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    const pageTextX = (pageWidth - pageTextWidth) / 2;
    pdf.text(pageText, pageTextX, pageHeight - 8);
    
    // Información de la empresa
    const companyText = 'Telas y Tejidos Luciana - Comparativa de Proveedores';
    const companyTextWidth = pdf.getTextWidth(companyText);
    const companyTextX = (pageWidth - companyTextWidth) / 2;
    pdf.text(companyText, companyTextX, pageHeight - 15);
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

    // Validar que hay proveedores
    const firstRow = data[0];
    if (!firstRow || Object.keys(firstRow).length <= 2) {
      errors.push('No se encontraron proveedores en los datos');
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
}