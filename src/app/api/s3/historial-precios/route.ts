import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { invalidateCachePattern } from "@/lib/cache-middleware";
import { cacheRedis, generateCacheKey } from "@/lib/redis";
import { CACHE_TTL } from "@/lib/redis";
import type { 
  PriceHistoryEntry, 
  FabricPriceHistory, 
  PriceHistorySummary,
  FabricMetadata,
  PriceHistoryResponse,
  BulkPriceUpdateRequest,
  PriceUpdateResponse
} from "@/types/price-history";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "telas-luciana";
const PRICE_HISTORY_PREFIX = "historial de precios/";

async function fetchPriceHistory(fabricId: string): Promise<PriceHistoryEntry[]> {
  try {
    const s3Key = `${PRICE_HISTORY_PREFIX}${fabricId}.json`;
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const content = await response.Body?.transformToString() || "[]";
    
    if (!content.trim()) {
      return [];
    }
    
    const data = JSON.parse(content);
    const historyArray = Array.isArray(data) ? data : [];
    
    // Validate that entries have required fields with more lenient validation
    const validEntries = historyArray.filter(entry => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }
      
      // More flexible field validation - check for various field name patterns
      const hasDate = entry.date || entry.fecha || entry.timestamp || entry.Date;
      const hasProvider = entry.provider || entry.proveedor || entry.supplier || entry.Provider;
      const hasQuantity = entry.quantity !== undefined && entry.quantity !== null && entry.quantity !== '' || 
                         entry.cantidad !== undefined && entry.cantidad !== null && entry.cantidad !== '' ||
                         entry.price !== undefined && entry.price !== null && entry.price !== '' ||
                         entry.precio !== undefined && entry.precio !== null && entry.precio !== '';
      
      if (!hasDate) {
        // Be more lenient - allow entries without dates if they have other meaningful data
        if (!hasProvider && !hasQuantity) {
          return false;
        }
      }
      
      if (!hasProvider) {
        // Be more lenient - allow entries without provider if they have date and quantity
        if (!hasDate && !hasQuantity) {
          return false;
        }
      }
      
      // More lenient quantity validation - try multiple field names and formats
      let quantity = entry.quantity || entry.cantidad || entry.price || entry.precio;
      
      if (quantity !== undefined && quantity !== null && quantity !== '') {
        // Try to parse as number
        const parsedQuantity = typeof quantity === 'number' ? quantity : parseFloat(String(quantity).replace(/[,$]/g, ''));
        if (isNaN(parsedQuantity)) {
          // Still allow the entry but with a default quantity of 0
          quantity = 0;
        } else {
          quantity = parsedQuantity;
        }
      } else {
        // Allow entries without quantity but set to 0
        quantity = 0;
      }
      
      return true; // Be very lenient - include almost all entries
    }).map(entry => {
      // Normalize the entry structure
      const date = entry.date || entry.fecha || entry.timestamp || entry.Date || new Date().toISOString();
      const provider = entry.provider || entry.proveedor || entry.supplier || entry.Provider || 'Unknown';
      let quantity = entry.quantity || entry.cantidad || entry.price || entry.precio || 0;
      
      // Parse quantity if needed
      if (typeof quantity !== 'number') {
        const parsed = parseFloat(String(quantity).replace(/[,$]/g, ''));
        quantity = isNaN(parsed) ? 0 : parsed;
      }
      
      return {
        date,
        provider,
        quantity,
        unit: entry.unit || entry.unidad || 'kg',
        // Preserve any additional fields
        ...entry
      };
    });
    
    return validEntries;
  } catch (error) {
    if (error instanceof Error && error.name !== 'NoSuchKey') {
      console.error(`Error fetching price history for ${fabricId}:`, error.message);
    }
    return [];
  }
}

function calculateSummary(
  fabricId: string, 
  history: PriceHistoryEntry[]
): PriceHistorySummary | null {
  if (!history || history.length === 0) return null;

  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const validEntries = history.filter(h => h.quantity > 0);
  const quantities = validEntries.map(h => h.quantity);
  
  const currentPrice = sortedHistory[0]?.quantity || 0;
  const previousPrice = sortedHistory[1]?.quantity || currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice > 0 
    ? (priceChange / previousPrice) * 100 
    : 0;

  const avgPrice = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
  const minPrice = Math.min(...quantities);
  const maxPrice = Math.max(...quantities);

  // Find entries with min and max prices
  const minPriceEntry = validEntries.find(entry => entry.quantity === minPrice);
  const maxPriceEntry = validEntries.find(entry => entry.quantity === maxPrice);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (priceChangePercent > 1) trend = 'up';
  else if (priceChangePercent < -1) trend = 'down';

  return {
    fabricId,
    fabricName: fabricId.replace(/\.(json|JSON)$/, ''),
    currentPrice,
    previousPrice,
    priceChange,
    priceChangePercent,
    trend,
    lastUpdated: sortedHistory[0]?.date || '',
    totalEntries: history.length,
    avgPrice,
    minPrice,
    maxPrice,
    unit: sortedHistory[0]?.unit || 'kg',
    // New fields for min/max provider and date info
    minPriceProvider: minPriceEntry?.provider || 'N/A',
    minPriceDate: minPriceEntry?.date || '',
    maxPriceProvider: maxPriceEntry?.provider || 'N/A',
    maxPriceDate: maxPriceEntry?.date || '',
  };
}

async function listAvailableFabrics(): Promise<FabricMetadata[]> {
  try {
    const fabrics: FabricMetadata[] = [];
    let continuationToken: string | undefined;
    
    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: PRICE_HISTORY_PREFIX,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        for (const item of response.Contents) {
          if (item.Key && item.Key.endsWith('.json')) {
            const fabricId = item.Key
              .replace(PRICE_HISTORY_PREFIX, '')
              .replace(/\.(json|JSON)$/, '');
            
            fabrics.push({
              id: fabricId,
              name: fabricId,
              hasHistory: true,
              entryCount: 0,
              lastUpdate: item.LastModified?.toISOString() || '',
            });
          }
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return fabrics;
  } catch (error) {
    console.error('Error listing fabrics:', error);
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const fabricIds = searchParams.get('fabricIds')?.split(',').filter(Boolean);
    const refresh = searchParams.get('refresh') === 'true';

    if (refresh) {
      await invalidateCachePattern('cache:price-history:*');
    }

    const cacheKey = generateCacheKey('price-history', {
      fabricIds: fabricIds?.join(',') || 'all'
    });
    
    // Check cache first
    const cached = await cacheRedis.get(cacheKey);
    if (cached && !refresh) {
      const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return NextResponse.json(cachedData);
    }
    
    // Generate fresh data
    const generateData = async () => {
        const fabrics: FabricPriceHistory[] = [];
        const summaries: PriceHistorySummary[] = [];

        if (fabricIds && fabricIds.length > 0) {
          for (const fabricId of fabricIds) {
            const history = await fetchPriceHistory(fabricId);
            
            if (history.length > 0) {
              fabrics.push({
                fabricId,
                fabricName: fabricId,
                history,
                lastUpdated: new Date().toISOString(),
              });

              const summary = calculateSummary(fabricId, history);
              if (summary) {
                summaries.push(summary);
              }
            }
          }
        } else {
          const availableFabrics = await listAvailableFabrics();
          
          for (const fabric of availableFabrics) {
            const history = await fetchPriceHistory(fabric.id);
            
            // Always include the fabric, even if history is empty
            fabrics.push({
              fabricId: fabric.id,
              fabricName: fabric.name,
              history,
              lastUpdated: fabric.lastUpdate,
            });

            // Only add to summary if there's actual history data
            if (history.length > 0) {
              const summary = calculateSummary(fabric.id, history);
              if (summary) {
                summaries.push(summary);
              }
            }
          }
        }

        let dateRange = { from: '', to: '' };
        if (fabrics.length > 0) {
          const allDates = fabrics
            .flatMap(f => f.history.map(h => h.date))
            .filter(Boolean)
            .sort();
          
          dateRange = {
            from: allDates[0] || '',
            to: allDates[allDates.length - 1] || '',
          };
        }

        const response: PriceHistoryResponse = {
          fabrics,
          summary: summaries,
          totalFabrics: fabrics.length,
          dateRange,
        };

        return response;
    };
    
    const freshData = await generateData();
    
    // Cache the fresh data
    await cacheRedis.setex(cacheKey, CACHE_TTL.INVENTORY, JSON.stringify(freshData));

    return NextResponse.json(freshData);
  } catch (error) {
    console.error('Error in price history API:', error);
    return NextResponse.json(
      { error: "Error al obtener historial de precios" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'major_admin')) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Clear all price history caches
    await invalidateCachePattern('cache:price-history*');
    
    return NextResponse.json({ 
      success: true, 
      message: "Cache invalidado correctamente" 
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json(
      { error: "Error al invalidar cache" },
      { status: 500 }
    );
  }
}

async function updateFabricPriceHistory(
  fabricId: string,
  added: PriceHistoryEntry[],
  updated: PriceHistoryEntry[],
  deleted: string[]
): Promise<PriceUpdateResponse> {

  try {
    // First, get current history
    const currentHistory = await fetchPriceHistory(fabricId);
    
    // Create a working copy with unique IDs for tracking
    let workingHistory = currentHistory.map((entry, index) => ({
      ...entry,
      _tempId: `existing-${index}-${entry.date}-${entry.provider}-${entry.unit || 'kg'}-${entry.quantity}`
    }));
    
    
    // Delete entries first
    if (deleted.length > 0) {
      // const beforeDelete = workingHistory.length;
      
      // deleted array contains identifiers that match the pattern used in the frontend
      deleted.forEach(deleteId => {
        workingHistory = workingHistory.filter(entry => {
          // Match based on combination of date, provider, unit, and quantity
          const entryId = `${entry.date}-${entry.provider}-${entry.unit || 'kg'}-${entry.quantity}`;
          const shouldKeep = !deleteId.includes(entryId) && entry._tempId !== deleteId;
          
          return shouldKeep;
        });
      });
    }
    
    // Update existing entries
    if (updated.length > 0) {
      updated.forEach((updatedEntry) => {
        const typedEntry = updatedEntry as PriceHistoryEntry & { _originalData?: PriceHistoryEntry };
        
        let index = -1;
        
        // If we have original data, use it to find the exact entry
        if (typedEntry._originalData) {
          const original = typedEntry._originalData;
          index = workingHistory.findIndex(
            existing => 
              existing.date === original.date && 
              existing.provider === original.provider &&
              existing.quantity === original.quantity &&
              (existing.unit || 'kg') === (original.unit || 'kg')
          );
        }
        
        // Fallback: find by date, provider, and unit if original data matching failed
        if (index === -1) {
          index = workingHistory.findIndex(
            existing => 
              existing.date === updatedEntry.date && 
              existing.provider === updatedEntry.provider &&
              (existing.unit || 'kg') === (updatedEntry.unit || 'kg')
          );
        }
        
        // Second fallback: find by date and provider only
        if (index === -1) {
          index = workingHistory.findIndex(
            existing => 
              existing.date === updatedEntry.date && 
              existing.provider === updatedEntry.provider
          );
        }
        
        if (index !== -1) {
          // Update the entry with new values, preserving _tempId
          workingHistory[index] = {
            ...workingHistory[index],
            provider: updatedEntry.provider,
            date: updatedEntry.date,
            quantity: Number(updatedEntry.quantity),
            unit: updatedEntry.unit || workingHistory[index].unit || 'kg'
          };
        } else {
          // If we can't find the entry to update, treat it as a new entry
          console.warn(`Could not find entry to update for ${updatedEntry.provider} on ${updatedEntry.date}, treating as new entry`);
          const newEntry = {
            provider: updatedEntry.provider,
            date: updatedEntry.date,
            quantity: Number(updatedEntry.quantity),
            unit: updatedEntry.unit || 'kg',
            _tempId: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };
          workingHistory.push(newEntry);
        }
      });
    }
    
    // Add new entries
    if (added.length > 0) {
      const newEntries = added.map((entry, index) => {
        const newEntry = {
          ...entry,
          date: entry.date,
          quantity: Number(entry.quantity),
          unit: entry.unit || 'kg',
          _tempId: `new-${index}-${entry.date}-${entry.provider}`
        };
        return newEntry;
      });
      
      workingHistory.push(...newEntries);
    }
    
    // Clean up temporary IDs and prepare final data
    const finalHistory = workingHistory.map(entry => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _tempId, ...cleanEntry } = entry as PriceHistoryEntry & { _tempId?: string };
      return {
        provider: cleanEntry.provider,
        date: cleanEntry.date,
        quantity: cleanEntry.quantity,
        unit: cleanEntry.unit
      };
    });
    
    // Sort by date (newest first)
    finalHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Save back to S3
    const s3Key = `${PRICE_HISTORY_PREFIX}${fabricId}.json`;
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(finalHistory, null, 2),
      ContentType: 'application/json',
    });
    
    await s3Client.send(putCommand);
    
    const result = {
      success: true,
      fabricId,
      message: `Actualizado exitosamente: ${finalHistory.length} registros totales`
    };
    
    return result;
    
  } catch (error) {
    console.error(`❌ Error updating ${fabricId}:`, error);
    const result = {
      success: false,
      fabricId,
      message: `Error al actualizar: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
    return result;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }
    
    // Check if user has permission to edit prices
    if (session.user.role !== 'admin' && session.user.role !== 'major_admin') {
      return NextResponse.json(
        { error: "Permisos insuficientes para editar precios" },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body: BulkPriceUpdateRequest = await req.json();
    
    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { error: "Formato de solicitud inválido" },
        { status: 400 }
      );
    }
    
    // Process each fabric update
    const results: PriceUpdateResponse[] = [];
    
    for (const update of body.updates) {
      const { fabricId, changes } = update;
      
      if (!fabricId) {
        results.push({
          success: false,
          fabricId: 'unknown',
          message: 'ID de tela faltante',
          errors: ['ID de tela es requerido']
        });
        continue;
      }
      
      const result = await updateFabricPriceHistory(
        fabricId,
        changes.added || [],
        changes.updated || [],
        changes.deleted || []
      );
      
      results.push(result);
    }
    
    // Clear caches for updated fabrics
    await invalidateCachePattern('cache:price-history*');
    
    // Determine overall success
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    const response = {
      success: errorCount === 0,
      message: `Operación completada: ${successCount} exitosas, ${errorCount} fallidas`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error in bulk price update:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { 
        error: "Error al procesar actualización de precios",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}