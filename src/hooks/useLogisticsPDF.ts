import { useState } from 'react';
import { LogisticsPDFGenerator } from '@/lib/pdf-utils';

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

interface UseLogisticsPDFReturn {
  isGenerating: boolean;
  error: string | null;
  generatePDF: (order: LogisticsData) => Promise<void>;
  clearError: () => void;
}

export const useLogisticsPDF = (): UseLogisticsPDFReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePDF = async (order: LogisticsData): Promise<void> => {
    try {
      setIsGenerating(true);
      setError(null);

      await LogisticsPDFGenerator.generateLogisticsOrderPDF(order);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al generar el PDF';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  return {
    isGenerating,
    error,
    generatePDF,
    clearError
  };
};