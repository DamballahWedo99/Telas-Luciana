import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { cacheRedis, generateCacheKey, CACHE_TTL } from "@/lib/redis";
import type { PriceHistoryEntry, FabricPriceHistory } from "@/types/price-history";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "telas-luciana";
const PRICE_HISTORY_PREFIX = "historial de precios/";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fabricId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { fabricId } = await context.params;
    
    if (!fabricId) {
      return NextResponse.json(
        { error: "ID de tela requerido" },
        { status: 400 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const provider = searchParams.get('provider');

    const cacheKey = generateCacheKey('price-history-fabric', {
      fabricId,
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      provider: provider || ''
    });
    
    // Check cache first
    const cached = await cacheRedis.get(cacheKey);
    if (cached) {
      const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return NextResponse.json(cachedData);
    }
    
    // Generate fresh data
    const generateData = async () => {
        try {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `${PRICE_HISTORY_PREFIX}${fabricId}.json`,
          });

          const response = await s3Client.send(command);
          const content = await response.Body?.transformToString() || "[]";
          
          let history: PriceHistoryEntry[] = JSON.parse(content);
          
          if (!Array.isArray(history)) {
            history = [];
          }

          if (dateFrom || dateTo) {
            const fromDate = dateFrom ? new Date(dateFrom) : new Date('1900-01-01');
            const toDate = dateTo ? new Date(dateTo) : new Date();
            
            history = history.filter(entry => {
              const entryDate = new Date(entry.date);
              return entryDate >= fromDate && entryDate <= toDate;
            });
          }

          if (provider) {
            history = history.filter(entry => 
              entry.provider?.toLowerCase().includes(provider.toLowerCase())
            );
          }

          history.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          const fabricHistory: FabricPriceHistory = {
            fabricId,
            fabricName: fabricId.replace(/\.(json|JSON)$/, '').replace(/_/g, ' '),
            history,
            lastUpdated: new Date().toISOString(),
          };

          return fabricHistory;
        } catch (s3Error) {
          console.error(`Error fetching from S3:`, s3Error);
          
          return {
            fabricId,
            fabricName: fabricId,
            history: [],
            lastUpdated: new Date().toISOString(),
          };
        }
    };
    
    const freshData = await generateData();
    
    // Cache the fresh data
    await cacheRedis.setex(cacheKey, CACHE_TTL.INVENTORY, JSON.stringify(freshData));

    return NextResponse.json(freshData);
  } catch (error) {
    console.error('Error in fabric price history API:', error);
    return NextResponse.json(
      { error: "Error al obtener historial de precios de la tela" },
      { status: 500 }
    );
  }
}