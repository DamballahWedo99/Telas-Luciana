import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PriceHistoryEntry } from '@/types/price-history';

interface ProviderStats {
  provider: string;
  totalEntries: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  color: string;
}

interface PriceFluctuationExportData {
  fabricId: string;
  fabricName: string;
  history: PriceHistoryEntry[];
  providers: ProviderStats[];
}

export class PriceFluctuationPDFExporter {
  private doc: jsPDF;
  private chartY: number = 0;
  private chartHeight: number = 0;
  
  constructor() {
    this.doc = new jsPDF('landscape', 'mm', 'a4');
  }

  public async export(
    data: PriceFluctuationExportData,
    filename?: string
  ): Promise<void> {
    try {
      // Add header
      this.addHeader(data.fabricName);
      
      // Capture and add chart
      await this.addChartImage(data.fabricName);
      
      // Add provider legend
      this.addProviderLegend(data.providers);
      
      // Add footer
      this.addFooter();
      
      // Save the PDF
      const finalFilename = filename || this.generateFilename(data.fabricName);
      this.doc.save(finalFilename);
      
    } catch (error) {
      console.error('Error exporting price fluctuation PDF:', error);
      throw error;
    }
  }

  private addHeader(fabricName: string): void {
    const pageWidth = this.doc.internal.pageSize.width;
    
    // Compact header to maximize chart space
    this.doc.setFillColor(248, 250, 252); // Very light gray background
    this.doc.rect(0, 0, pageWidth, 40, 'F'); // Reduced header height to 40mm
    
    // Professional title - more compact
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(18); // Slightly smaller to save space
    this.doc.setTextColor(33, 37, 41);
    this.doc.text('Análisis de Fluctuación de Precios', pageWidth / 2, 18, { align: 'center' });
    
    // Subtitle with fabric name - more compact
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(14);
    this.doc.setTextColor(59, 130, 246);
    this.doc.text(`Tela: ${fabricName}`, pageWidth / 2, 28, { align: 'center' });
    
    // Generation date - more compact
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(108, 117, 125);
    const currentDate = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    this.doc.text(`Fecha de generación: ${currentDate}`, pageWidth / 2, 36, { align: 'center' });
    
    // Separator line
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.5);
    this.doc.line(20, 39, pageWidth - 20, 39);
  }


  private async addChartImage(fabricName: string): Promise<void> {
    try {
      // Generate chart ID based on fabric name (capture only the chart container, not the title)
      const chartId = `chart-only-${fabricName.replace(/\s+/g, '-').toLowerCase()}`;
      const chartElement = document.getElementById(chartId);
      
      if (!chartElement) {
        console.warn('Chart element not found, skipping chart capture');
        this.addNoChartMessage();
        return;
      }

      // Store original devicePixelRatio
      const originalPixelRatio = window.devicePixelRatio;
      
      try {
        // Set high DPI for professional quality
        window.devicePixelRatio = 3;
        
        // Calculate optimal scale for 300 DPI quality
        const baseScale = Math.max(3, window.devicePixelRatio * 1.5);
        const optimalScale = Math.min(baseScale, 4); // Cap at 4 to prevent memory issues
        
        // Capture chart as high-resolution canvas
        const canvas = await html2canvas(chartElement, {
          backgroundColor: '#ffffff',
          scale: optimalScale, // This achieves 300 DPI equivalent quality
          useCORS: true,
          allowTaint: true,
          logging: false,
          height: chartElement.offsetHeight,
          width: chartElement.offsetWidth,
          onclone: (clonedDoc, element) => {
            // Optimize fonts and rendering for PDF export
            const style = element.style;
            style.fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
            (style as CSSStyleDeclaration & { textRendering?: string }).textRendering = 'optimizeLegibility';
            (style as CSSStyleDeclaration & { webkitFontSmoothing?: string }).webkitFontSmoothing = 'antialiased';
            (style as CSSStyleDeclaration & { mozOsxFontSmoothing?: string }).mozOsxFontSmoothing = 'grayscale';
            
            // Enhance chart elements for better PDF rendering
            const chartElements = element.querySelectorAll('svg, text, path, line');
            chartElements.forEach((el: Element) => {
              const htmlEl = el as HTMLElement;
              const elStyle = htmlEl.style;
              (elStyle as CSSStyleDeclaration & { shapeRendering?: string }).shapeRendering = 'geometricPrecision';
              if (htmlEl.tagName === 'TEXT') {
                (elStyle as CSSStyleDeclaration & { textRendering?: string }).textRendering = 'optimizeLegibility';
              }
            });
          }
        });
        
        // Restore original devicePixelRatio
        window.devicePixelRatio = originalPixelRatio;

        // Convert canvas to high-quality image data - use JPEG for better compression and quality
        const imgData = canvas.toDataURL('image/jpeg', 0.98); // 98% quality for professional output
      
        // Calculate dimensions for PDF with MUCH larger chart - landscape orientation
        const pageWidth = this.doc.internal.pageSize.width; // ~297mm for A4 landscape
        const pageHeight = this.doc.internal.pageSize.height; // ~210mm for A4 landscape
        const legendHeight = 30; // Reduced legend space
        const professionalMargins = 15; // Reduced margins to give more space to chart
        const maxWidth = pageWidth - (professionalMargins * 2); // Almost full width
        const maxHeight = pageHeight - 80 - legendHeight; // Reduced header/footer space, maximized chart space
      
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const aspectRatio = imgHeight / imgWidth;
        
        // Calculate optimal dimensions maintaining aspect ratio
        let finalWidth = maxWidth;
        let finalHeight = finalWidth * aspectRatio;
        
        // If height is too large, scale down by height
        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = finalHeight / aspectRatio;
        }
      
        // Center chart horizontally with minimal margins for maximum size
        const x = (pageWidth - finalWidth) / 2;
        const headerHeight = 45; // Reduced header height
        const availableHeight = pageHeight - headerHeight - legendHeight - 25; // Reduced footer space
        const y = headerHeight + (availableHeight - finalHeight) / 2;
        
        // Store chart position for legend placement
        this.chartY = y;
        this.chartHeight = finalHeight;
        
        // Add high-quality image to PDF - use JPEG format for better compression
        this.doc.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
      
      } catch (captureError) {
        // Restore original devicePixelRatio in case of error
        window.devicePixelRatio = originalPixelRatio;
        console.error('Error capturing high-resolution chart:', captureError);
        this.addNoChartMessage();
      }
    } catch (error) {
      console.error('Error in chart image processing:', error);
      this.addNoChartMessage();
    }
  }
  
  private addNoChartMessage(): void {
    const pageWidth = this.doc.internal.pageSize.width;
    
    this.doc.setFontSize(12);
    this.doc.setTextColor(108, 117, 125);
    this.doc.text(
      'Gráfico de fluctuación no disponible',
      pageWidth / 2,
      180,
      { align: 'center' }
    );
    
    this.doc.setFontSize(10);
    this.doc.text(
      '(El gráfico se genera dinámicamente en la aplicación)',
      pageWidth / 2,
      190,
      { align: 'center' }
    );
  }

  private addProviderLegend(providers: ProviderStats[]): void {
    const pageWidth = this.doc.internal.pageSize.width;
    
    // Position legend horizontally below the chart with minimal spacing to maximize chart size
    const legendY = this.chartY + this.chartHeight + 15; // Reduced spacing to give more room to chart
    
    // Calculate optimal spacing for horizontal layout
    const totalProviders = providers.length;
    const professionalMargins = 50; // Margins for professional appearance
    const availableWidth = pageWidth - (professionalMargins * 2);
    const itemWidth = availableWidth / totalProviders;
    
    // Professional typography settings
    this.doc.setFontSize(11); // Slightly larger for better readability
    
    providers.forEach((provider, index) => {
      // Calculate centered position for each provider
      const centerX = professionalMargins + (index * itemWidth) + (itemWidth / 2);
      
      // Draw professional color indicator (larger circle)
      const circleRadius = 3; // Larger radius for better visibility
      const circleX = centerX - 15; // Position to the left of text
      const circleY = legendY;
      
      // Convert hex color to RGB with proper parsing
      const hexColor = provider.color.replace('#', '');
      const r = parseInt(hexColor.substring(0, 2), 16);
      const g = parseInt(hexColor.substring(2, 4), 16);
      const b = parseInt(hexColor.substring(4, 6), 16);
      
      // Draw filled circle with border for professional appearance
      this.doc.setFillColor(r, g, b);
      this.doc.setDrawColor(0, 0, 0); // Black border
      this.doc.setLineWidth(0.2);
      this.doc.circle(circleX, circleY, circleRadius, 'FD'); // Fill and Draw (border)
      
      // Professional text styling
      this.doc.setTextColor(33, 37, 41); // Dark gray for provider name
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(provider.provider, circleX + 8, legendY + 1, { align: 'left' });
      
      // Record count in lighter color
      this.doc.setTextColor(108, 117, 125); // Medium gray
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10); // Slightly smaller for record count
      this.doc.text(
        `(${provider.totalEntries} registro${provider.totalEntries !== 1 ? 's' : ''})`, 
        circleX + 8, 
        legendY + 7, 
        { align: 'left' }
      );
      
      // Reset font size for next iteration
      this.doc.setFontSize(11);
    });
  }

  private addFooter(): void {
    const pageHeight = this.doc.internal.pageSize.height;
    const pageWidth = this.doc.internal.pageSize.width;
    
    // Compact footer to maximize chart space
    const footerY = pageHeight - 10; // Moved footer closer to bottom
    
    // Add subtle separator line above footer
    this.doc.setDrawColor(220, 220, 220);
    this.doc.setLineWidth(0.3);
    this.doc.line(30, footerY - 3, pageWidth - 30, footerY - 3);
    
    // Compact footer text
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8); // Smaller font to save space
    this.doc.setTextColor(108, 117, 125);
    this.doc.text(
      'Telas y Tejidos Luciana - Sistema de Gestión de Inventario',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    
    // Add generation timestamp in even smaller text
    this.doc.setFontSize(7);
    this.doc.setTextColor(150, 150, 150);
    const timestamp = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    this.doc.text(
      `Generado el ${timestamp}`,
      pageWidth - 30,
      footerY,
      { align: 'right' }
    );
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // Handle dates in YYYY-MM-DD format (avoid timezone conversion)
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    
    // Fallback
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }


  private generateFilename(fabricName: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const safeFabricName = fabricName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `fluctuacion_precios_${safeFabricName}_${timestamp}.pdf`;
  }
}