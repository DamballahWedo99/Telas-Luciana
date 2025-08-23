import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { invalidateCachePattern } from "@/lib/cache-middleware";
import type { 
  NewProductRequest, 
  NewProductResponse,
  PriceHistoryEntry
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

// Generate fabricId from fabric name
function generateFabricId(fabricName: string): string {
  return fabricName.trim()
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[^\w\-_]/g, '') // Remove special characters except underscore and hyphen
    .toUpperCase();
}

// Check if fabricId already exists
async function fabricIdExists(fabricId: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${PRICE_HISTORY_PREFIX}${fabricId}.json`,
    });
    
    await s3Client.send(command);
    return true; // If no error, file exists
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
      return false; // File doesn't exist
    }
    // For other errors, assume it exists to be safe
    console.error('Error checking fabric existence:', error);
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }
    
    // Check if user has permission to create products (same as editing prices)
    if (session.user.role !== 'admin' && session.user.role !== 'major_admin') {
      return NextResponse.json(
        { error: "Permisos insuficientes para crear productos" },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body: NewProductRequest = await req.json();
    
    // Validate request body
    if (!body.fabricName || typeof body.fabricName !== 'string') {
      return NextResponse.json(
        { error: "Nombre de producto requerido" },
        { status: 400 }
      );
    }

    if (!body.initialPrice || typeof body.initialPrice !== 'object') {
      return NextResponse.json(
        { error: "Precio inicial requerido" },
        { status: 400 }
      );
    }

    const { provider, date, quantity, unit } = body.initialPrice;

    // Validate initial price data
    if (!provider || typeof provider !== 'string' || provider.trim().length === 0) {
      return NextResponse.json(
        { error: "Proveedor requerido" },
        { status: 400 }
      );
    }

    if (!date || typeof date !== 'string') {
      return NextResponse.json(
        { error: "Fecha requerida" },
        { status: 400 }
      );
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: "Precio debe ser un número mayor a 0" },
        { status: 400 }
      );
    }

    if (!unit || typeof unit !== 'string') {
      return NextResponse.json(
        { error: "Unidad requerida" },
        { status: 400 }
      );
    }

    // Validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Fecha inválida" },
        { status: 400 }
      );
    }

    if (parsedDate > new Date()) {
      return NextResponse.json(
        { error: "La fecha no puede ser en el futuro" },
        { status: 400 }
      );
    }

    // Validate unit
    const validUnits = ['kg', 'mt'];
    if (!validUnits.includes(unit)) {
      return NextResponse.json(
        { error: "Unidad inválida" },
        { status: 400 }
      );
    }

    // Generate fabricId
    const fabricId = generateFabricId(body.fabricName);
    
    if (!fabricId || fabricId.length === 0) {
      return NextResponse.json(
        { error: "No se pudo generar ID válido del nombre del producto" },
        { status: 400 }
      );
    }

    // Check if fabricId already exists
    const exists = await fabricIdExists(fabricId);
    if (exists) {
      return NextResponse.json(
        { error: "Ya existe un producto con este nombre" },
        { status: 409 }
      );
    }

    // Create initial price history entry
    const initialEntry: PriceHistoryEntry = {
      provider: provider.trim(),
      date: date,
      quantity: quantity,
      unit: unit,
    };

    // Create the price history file with the initial entry
    const historyData: PriceHistoryEntry[] = [initialEntry];

    try {
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${PRICE_HISTORY_PREFIX}${fabricId}.json`,
        Body: JSON.stringify(historyData, null, 2),
        ContentType: 'application/json',
        Metadata: {
          'created-by': session.user.email || 'unknown',
          'created-at': new Date().toISOString(),
          'fabric-name': body.fabricName.trim(),
        }
      });

      await s3Client.send(putCommand);
      
      // Invalidate price history caches
      await invalidateCachePattern('cache:price-history*');
      
      const response: NewProductResponse = {
        success: true,
        fabricId: fabricId,
        message: `Producto "${body.fabricName.trim()}" creado exitosamente`,
      };

      return NextResponse.json(response, { status: 201 });

    } catch (s3Error) {
      console.error('Error creating product in S3:', s3Error);
      return NextResponse.json(
        { error: "Error al guardar el producto en el sistema de almacenamiento" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in create product API:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}