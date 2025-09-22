import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable properties
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface TelaLogistic {
  tipo_tela: string;
}

interface LogisticsData {
  orden_de_compra: string;
  tela: TelaLogistic[];
  contenedor: string;
  etd: string;
  eta: string;
  importador: string;
  notas: string;
  fecha_registro?: string;
  fecha_actualizacion?: string;
}

export class LogisticsPDFGenerator {
  private static readonly COLORS = {
    primary: '#1f2937',
    accent: '#3b82f6',
    success: '#10b981',
    text: '#374151',
    lightGray: '#f3f4f6',
    border: '#e5e7eb'
  };

  private static readonly FONTS = {
    header: 18,
    subheading: 14,
    body: 11,
    footer: 9
  };

  /**
   * Generates a PDF document for a logistics order
   */
  static generateLogisticsOrderPDF(order: LogisticsData): void {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;

      // Add header
      yPosition = this.addHeaderSection(doc, order);
      
      // Add order details
      yPosition = this.addOrderDetailsTable(doc, order, yPosition + 10);
      
      // Add schedule section
      yPosition = this.addScheduleSection(doc, order, yPosition + 10);
      
      // Add fabrics table
      if (order.tela && order.tela.length > 0) {
        yPosition = this.addFabricsTable(doc, order.tela, yPosition + 10);
      }
      
      // Add notes section
      if (order.notas && order.notas.trim()) {
        this.addNotesSection(doc, order.notas, yPosition + 10);
      }
      
      // Add footer
      this.addFooter(doc);
      
      // Generate filename
      const filename = `Logistica_${order.orden_de_compra}_${this.formatDateForFilename(new Date())}.pdf`;
      
      // Save the PDF
      doc.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Error al generar el PDF. Por favor, inténtalo de nuevo.');
    }
  }

  /**
   * Formats a date string for PDF display (DD/MM/YYYY)
   */
  static formatDateForPDF(dateString: string): string {
    if (!dateString) return 'No especificada';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  /**
   * Formats date for filename (YYYY-MM-DD)
   */
  private static formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Adds header section with company info and order number
   */
  private static addHeaderSection(doc: jsPDF, order: LogisticsData): number {
    const pageWidth = doc.internal.pageSize.width;
    
    // Company header
    doc.setFontSize(this.FONTS.header);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLORS.primary);
    doc.text('Telas y Tejidos Luciana', pageWidth / 2, 25, { align: 'center' });
    
    // Document title
    doc.setFontSize(this.FONTS.subheading);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLORS.accent);
    doc.text('Información Logística', pageWidth / 2, 35, { align: 'center' });
    
    // Order number
    doc.setFontSize(this.FONTS.body);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(this.COLORS.text);
    doc.text(`Orden de Compra: ${order.orden_de_compra}`, pageWidth / 2, 45, { align: 'center' });
    
    // Generation date
    doc.setFontSize(this.FONTS.footer);
    doc.text(`Generado el: ${this.formatDateForPDF(new Date().toISOString())}`, pageWidth / 2, 52, { align: 'center' });
    
    // Add separator line
    doc.setDrawColor(this.COLORS.border);
    doc.line(20, 58, pageWidth - 20, 58);
    
    return 65;
  }

  /**
   * Adds order details table
   */
  private static addOrderDetailsTable(doc: jsPDF, order: LogisticsData, yPosition: number): number {
    doc.setFontSize(this.FONTS.subheading);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLORS.primary);
    doc.text('Detalles de la Orden', 20, yPosition);
    
    const tableData = [
      ['Orden de Compra', order.orden_de_compra || 'No especificada'],
      ['Contenedor', order.contenedor || 'No especificado'],
      ['Importador', order.importador || 'No especificado'],
    ];
    
    if (order.fecha_registro) {
      tableData.push(['Fecha de Registro', this.formatDateForPDF(order.fecha_registro)]);
    }
    
    if (order.fecha_actualizacion) {
      tableData.push(['Última Actualización', this.formatDateForPDF(order.fecha_actualizacion)]);
    }

    autoTable(doc, {
      startY: yPosition + 8,
      head: [],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: this.FONTS.body,
        textColor: this.COLORS.text,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: this.COLORS.lightGray, cellWidth: 50 },
        1: { cellWidth: 120 }
      },
      margin: { left: 20, right: 20 }
    });

    return doc.lastAutoTable.finalY;
  }

  /**
   * Adds schedule section with ETD and ETA
   */
  private static addScheduleSection(doc: jsPDF, order: LogisticsData, yPosition: number): number {
    if (!order.etd && !order.eta) {
      return yPosition;
    }
    
    doc.setFontSize(this.FONTS.subheading);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLORS.primary);
    doc.text('Cronograma de Embarque', 20, yPosition);
    
    const scheduleData = [];
    
    if (order.etd) {
      scheduleData.push(['ETD (Fecha de Salida)', this.formatDateForPDF(order.etd)]);
    }
    
    if (order.eta) {
      scheduleData.push(['ETA (Fecha de Llegada)', this.formatDateForPDF(order.eta)]);
    }

    autoTable(doc, {
      startY: yPosition + 8,
      head: [],
      body: scheduleData,
      theme: 'grid',
      styles: {
        fontSize: this.FONTS.body,
        textColor: this.COLORS.text,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: this.COLORS.lightGray, cellWidth: 50 },
        1: { cellWidth: 120 }
      },
      margin: { left: 20, right: 20 }
    });

    return doc.lastAutoTable.finalY;
  }

  /**
   * Adds fabrics table
   */
  private static addFabricsTable(doc: jsPDF, fabrics: TelaLogistic[], yPosition: number): number {
    doc.setFontSize(this.FONTS.subheading);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLORS.primary);
    doc.text(`Telas Registradas (${fabrics.length})`, 20, yPosition);
    
    const fabricsData = fabrics.map((tela, index) => [
      (index + 1).toString(),
      tela.tipo_tela || 'No especificada'
    ]);

    autoTable(doc, {
      startY: yPosition + 8,
      head: [['#', 'Tipo de Tela']],
      body: fabricsData,
      theme: 'grid',
      styles: {
        fontSize: this.FONTS.body,
        textColor: this.COLORS.text,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: this.COLORS.accent,
        textColor: '#ffffff',
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 150 }
      },
      margin: { left: 20, right: 20 }
    });

    return doc.lastAutoTable.finalY;
  }

  /**
   * Adds notes section
   */
  private static addNotesSection(doc: jsPDF, notes: string, yPosition: number): number {
    doc.setFontSize(this.FONTS.subheading);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLORS.primary);
    doc.text('Notas Adicionales', 20, yPosition);
    
    // Split notes into lines to fit page width
    const pageWidth = doc.internal.pageSize.width;
    const maxWidth = pageWidth - 40; // Account for margins
    
    doc.setFontSize(this.FONTS.body);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(this.COLORS.text);
    
    const splitNotes = doc.splitTextToSize(notes, maxWidth);
    
    // Add border around notes
    const textHeight = splitNotes.length * 6; // Approximate line height
    doc.setDrawColor(this.COLORS.border);
    doc.setFillColor(this.COLORS.lightGray);
    doc.rect(20, yPosition + 5, maxWidth, textHeight + 10, 'FD');
    
    doc.text(splitNotes, 25, yPosition + 12);
    
    return yPosition + textHeight + 20;
  }

  /**
   * Adds footer with export information
   */
  private static addFooter(doc: jsPDF): void {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    
    doc.setFontSize(this.FONTS.footer);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(this.COLORS.text);
    
    const footerText = `Documento generado automáticamente por Telas y Tejidos Luciana - ${new Date().toLocaleString('es-ES')}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 15, { align: 'center' });
    
    // Add page number
    doc.text(`Página 1`, pageWidth - 20, pageHeight - 15, { align: 'right' });
  }
}