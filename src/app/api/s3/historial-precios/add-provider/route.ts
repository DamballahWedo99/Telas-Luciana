import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { invalidateCachePattern } from "@/lib/cache-middleware";
import type { 
  NewProviderRequest, 
  NewProviderResponse,
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

// Check if fabricId exists and get existing history
async function getFabricHistory(fabricId: string): Promise<PriceHistoryEntry[] | null> {
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
    
    return history;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
      return null; // Fabric doesn't exist
    }
    // For other errors, throw to be handled by caller
    throw error;
  }
}

// Check if provider already exists for the same date
function providerExistsForDate(history: PriceHistoryEntry[], provider: string, date: string): boolean {
  return history.some(entry => 
    entry.provider.toLowerCase() === provider.toLowerCase() && 
    entry.date === date
  );
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
    
    // Check if user has permission to add providers (same as editing prices)
    if (session.user.role !== 'admin' && session.user.role !== 'major_admin') {
      return NextResponse.json(
        { error: "Permisos insuficientes para agregar proveedores" },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body: NewProviderRequest = await req.json();
    
    // Validate request body
    if (!body.fabricId || typeof body.fabricId !== 'string') {
      return NextResponse.json(
        { error: "ID de tela requerido" },
        { status: 400 }
      );
    }

    if (!body.provider || typeof body.provider !== 'string' || body.provider.trim().length === 0) {
      return NextResponse.json(
        { error: "Proveedor requerido" },
        { status: 400 }
      );
    }

    if (!body.date || typeof body.date !== 'string') {
      return NextResponse.json(
        { error: "Fecha requerida" },
        { status: 400 }
      );
    }

    if (typeof body.quantity !== 'number' || body.quantity <= 0) {
      return NextResponse.json(
        { error: "Precio debe ser un número mayor a 0" },
        { status: 400 }
      );
    }

    if (!body.unit || typeof body.unit !== 'string') {
      return NextResponse.json(
        { error: "Unidad requerida" },
        { status: 400 }
      );
    }

    // Validate provider
    if (body.provider.trim().length < 2) {
      return NextResponse.json(
        { error: "El proveedor debe tener al menos 2 caracteres" },
        { status: 400 }
      );
    }

    if (body.provider.trim().length > 50) {
      return NextResponse.json(
        { error: "El proveedor no puede exceder 50 caracteres" },
        { status: 400 }
      );
    }

    // Validate date
    const parsedDate = new Date(body.date);
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

    // Validate quantity
    if (body.quantity > 999999) {
      return NextResponse.json(
        { error: "El precio no puede exceder 999,999" },
        { status: 400 }
      );
    }

    // Validate unit
    const validUnits = ['kg', 'mt'];
    if (!validUnits.includes(body.unit)) {
      return NextResponse.json(
        { error: "Unidad inválida" },
        { status: 400 }
      );
    }

    // Get existing fabric history
    const existingHistory = await getFabricHistory(body.fabricId);
    
    if (existingHistory === null) {
      return NextResponse.json(
        { error: "La tela especificada no existe" },
        { status: 404 }
      );
    }

    // Check if provider already exists for this date
    if (providerExistsForDate(existingHistory, body.provider.trim(), body.date)) {
      return NextResponse.json(
        { error: "Ya existe un precio para este proveedor en la fecha especificada" },
        { status: 409 }
      );
    }

    // Create new price history entry
    const newEntry: PriceHistoryEntry = {
      provider: body.provider.trim(),
      date: body.date,
      quantity: body.quantity,
      unit: body.unit,
    };

    // Add new entry to history and sort by date (newest first)
    const updatedHistory = [...existingHistory, newEntry];
    updatedHistory.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    try {
      // Save updated history to S3
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${PRICE_HISTORY_PREFIX}${body.fabricId}.json`,
        Body: JSON.stringify(updatedHistory, null, 2),
        ContentType: 'application/json',
        Metadata: {
          'updated-by': session.user.email || 'unknown',
          'updated-at': new Date().toISOString(),
          'provider-added': body.provider.trim(),
        }
      });

      await s3Client.send(putCommand);
      
      // Invalidate price history caches
      await invalidateCachePattern('cache:price-history*');
      
      const response: NewProviderResponse = {
        success: true,
        message: `Proveedor "${body.provider.trim()}" agregado exitosamente a la tela "${body.fabricId}"`,
      };

      return NextResponse.json(response, { status: 201 });

    } catch (s3Error) {
      console.error('Error updating fabric history in S3:', s3Error);
      return NextResponse.json(
        { error: "Error al guardar el proveedor en el sistema de almacenamiento" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in add provider API:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}