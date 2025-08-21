import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFExporter, PDFExportOptions, TraditionalExportData, PDFHeader, PDFFooter } from '@/types/pdf-export';
import { PriceHistoryResponse } from '@/types/price-history';

export class TraditionalPDFExporter extends PDFExporter {
  async export(data: PriceHistoryResponse, options: PDFExportOptions): Promise<void> {
    const doc = new jsPDF({
      orientation: this.config.orientation,
      unit: 'mm',
      format: this.config.format,
    });

    // Preparar datos para la tabla
    const tableData = this.prepareTableData(data);
    
    // Configurar fuentes
    doc.setFont('helvetica');
    
    // Agregar header
    this.addHeader(doc, options.header);
    
    // Agregar tabla
    this.addTable(doc, tableData);
    
    // Agregar footer si se especifica
    if (options.footer) {
      this.addFooter(doc, options.footer);
    }
    
    // Guardar el archivo
    doc.save(options.filename);
  }

  private prepareTableData(data: PriceHistoryResponse): TraditionalExportData {
    const fabrics = data.fabrics.map(fabric => {
      const summary = data.summary.find(s => s.fabricId === fabric.fabricId);
      return {
        nombre: fabric.fabricName,
        precioMin: summary ? this.formatPrice(summary.minPrice) : 'N/A',
        precioMax: summary ? this.formatPrice(summary.maxPrice) : 'N/A',
        precioPromedio: summary ? this.formatPrice(summary.avgPrice) : 'N/A',
        unidad: summary ? summary.unit : 'N/A',
      };
    });

    return { fabrics };
  }

  private addHeader(doc: jsPDF, header: PDFHeader): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Título principal
    doc.setFontSize(this.config.fontSize.title);
    doc.setTextColor(...this.config.colors.primary);
    doc.text(header.title, pageWidth / 2, 25, { align: 'center' });
    
    // Subtítulo si existe
    if (header.subtitle) {
      doc.setFontSize(this.config.fontSize.subtitle);
      doc.setTextColor(...this.config.colors.secondary);
      doc.text(header.subtitle, pageWidth / 2, 35, { align: 'center' });
    }
    
    // Fecha
    doc.setFontSize(this.config.fontSize.body);
    doc.setTextColor(...this.config.colors.secondary);
    doc.text(`Generado el: ${header.date}`, pageWidth / 2, 45, { align: 'center' });
    
    // Línea separadora
    doc.setDrawColor(...this.config.colors.primary);
    doc.setLineWidth(0.5);
    doc.line(this.config.margin, 50, pageWidth - this.config.margin, 50);
  }

  private addTable(doc: jsPDF, data: TraditionalExportData): void {
    const columns = [
      { header: 'Nombre', dataKey: 'nombre' },
      { header: 'Precio Min', dataKey: 'precioMin' },
      { header: 'Precio Max', dataKey: 'precioMax' },
      { header: 'Precio Promedio', dataKey: 'precioPromedio' },
      { header: 'Unidad', dataKey: 'unidad' },
    ];

    // Calcular ancho equitativo para 5 columnas
    // A4 landscape = 297mm, con márgenes de 15mm cada lado = 267mm disponible
    const availableWidth = 267;
    const columnWidth = availableWidth / 5; // ~53.4mm por columna

    autoTable(doc, {
      columns,
      body: data.fabrics,
      startY: 60,
      margin: { left: this.config.margin, right: this.config.margin },
      tableWidth: 'auto',
      styles: {
        fontSize: this.config.fontSize.body,
        cellPadding: 3,
        textColor: this.config.colors.primary,
      },
      headStyles: {
        fillColor: this.config.colors.background,
        textColor: this.config.colors.primary,
        fontStyle: 'bold',
        fontSize: this.config.fontSize.header,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      tableLineColor: this.config.colors.border,
      tableLineWidth: 0.1,
      columnStyles: {
        nombre: { cellWidth: columnWidth, halign: 'left' },
        precioMin: { cellWidth: columnWidth, halign: 'center' },
        precioMax: { cellWidth: columnWidth, halign: 'center' },
        precioPromedio: { cellWidth: columnWidth, halign: 'center' },
        unidad: { cellWidth: columnWidth, halign: 'center' },
      },
      didParseCell: (data: { section: string; column: { index: number }; cell: { styles: { halign: string } } }) => {
        // Configurar alineación de headers basado en la columna
        if (data.section === 'head') {
          switch (data.column.index) {
            case 0: // nombre
              data.cell.styles.halign = 'left';
              break;
            case 1: // precioMin
            case 2: // precioMax
            case 3: // precioPromedio
            case 4: // unidad
              data.cell.styles.halign = 'center';
              break;
          }
        }
      },
      didDrawPage: () => {
        // Agregar número de página
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setFontSize(this.config.fontSize.footer);
        doc.setTextColor(...this.config.colors.secondary);
        doc.text(
          `Página ${doc.getCurrentPageInfo().pageNumber}`,
          pageWidth - this.config.margin,
          pageHeight - 10,
          { align: 'right' }
        );
      },
    });
  }

  private addFooter(doc: jsPDF, footer: PDFFooter): void {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Línea separadora
    doc.setDrawColor(...this.config.colors.border);
    doc.setLineWidth(0.3);
    doc.line(this.config.margin, pageHeight - 25, pageWidth - this.config.margin, pageHeight - 25);
    
    // Textos del footer
    doc.setFontSize(this.config.fontSize.footer);
    doc.setTextColor(...this.config.colors.secondary);
    
    if (footer.leftText) {
      doc.text(footer.leftText, this.config.margin, pageHeight - 15);
    }
    
    if (footer.centerText) {
      doc.text(footer.centerText, pageWidth / 2, pageHeight - 15, { align: 'center' });
    }
    
    if (footer.rightText) {
      doc.text(footer.rightText, pageWidth - this.config.margin, pageHeight - 15, { align: 'right' });
    }
  }

}