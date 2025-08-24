import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateAndWarmInventory } from "@/lib/cache-warming";
import { invalidateCachePattern } from "@/lib/cache-middleware";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "telas-luciana";

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes. Por favor, espera un momento."
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const session = await auth();
    if (!session) {
      console.log("❌ [DELETE-PENDING] Sin sesión");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Check admin permissions
    const userRole = session.user?.role;
    if (userRole !== "admin" && userRole !== "major_admin") {
      console.log("❌ [DELETE-PENDING] Sin permisos de admin:", userRole);
      return NextResponse.json(
        { error: "No tienes permisos para eliminar registros" },
        { status: 403 }
      );
    }

    // Get OC from request body
    const body = await request.json();
    const { oc } = body;

    if (!oc) {
      console.log("❌ [DELETE-PENDING] OC no proporcionada");
      return NextResponse.json(
        { error: "OC es requerida" },
        { status: 400 }
      );
    }

    console.log(`🗑️ [DELETE-PENDING] Eliminando registros pending para OC: ${oc}`);

    // Get current date for S3 path - MUST match get-pending-files path format
    const now = new Date();
    const year = now.getFullYear();
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const month = monthNames[now.getMonth()];
    const prefix = `Inventario/${year}/${month}/`;

    // List all objects in the current month
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const files = listResponse.Contents || [];

    console.log(`📁 [DELETE-PENDING] Total de archivos en ${prefix}: ${files.length}`);

    // Track deleted files
    const deletedFiles: string[] = [];
    const deletedRollFiles: string[] = [];
    let totalDeletedFabrics = 0;
    let totalDeletedRolls = 0;

    // Check each file for matching OC and pending status
    for (const file of files) {
      if (!file.Key || !file.Key.endsWith(".json")) continue;

      try {
        // Get file content
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.Key,
        });

        const getResponse = await s3Client.send(getCommand);
        const fileContent = await getResponse.Body?.transformToString();
        
        if (!fileContent) continue;

        const data = JSON.parse(fileContent);

        // Check if this file contains fabrics for the given OC
        if (data.status === "pending") {
          if (data.fabrics) {
            // Handle pending files with arrays of fabrics
            interface FabricData {
              oc?: string;
              [key: string]: unknown;
            }
            
            const matchingFabrics = data.fabrics.filter((fabric: FabricData) => 
              fabric.oc === oc || (oc === "SIN_OC" && !fabric.oc)
            );

            if (matchingFabrics.length > 0) {
              console.log(`🔍 [DELETE-PENDING] Archivo pending (array) ${file.Key} contiene ${matchingFabrics.length} telas de OC ${oc}`);
              
              // Delete the file if ALL fabrics in it match the OC
              if (matchingFabrics.length === data.fabrics.length) {
                const deleteCommand = new DeleteObjectCommand({
                  Bucket: BUCKET_NAME,
                  Key: file.Key,
                });

                await s3Client.send(deleteCommand);
                deletedFiles.push(file.Key);
                totalDeletedFabrics += matchingFabrics.length;
                
                console.log(`✅ [DELETE-PENDING] Archivo pending (array) eliminado: ${file.Key}`);
              } else {
                // If file contains fabrics from multiple OCs, update it to remove only the matching ones
                const remainingFabrics = data.fabrics.filter((fabric: FabricData) => 
                  fabric.oc !== oc && (oc !== "SIN_OC" || fabric.oc)
                );

                const updatedData = {
                  ...data,
                  fabrics: remainingFabrics,
                  totalFabrics: remainingFabrics.length
                };

                // Re-upload the file with remaining fabrics
                const putCommand = new PutObjectCommand({
                  Bucket: BUCKET_NAME,
                  Key: file.Key,
                  Body: JSON.stringify(updatedData, null, 2),
                  ContentType: "application/json",
                });

                await s3Client.send(putCommand);
                totalDeletedFabrics += matchingFabrics.length;
                
                console.log(`📝 [DELETE-PENDING] Archivo pending (array) actualizado: ${file.Key} (removidas ${matchingFabrics.length} telas)`);
              }
            }
          } else if (data.OC === oc || (oc === "SIN_OC" && !data.OC)) {
            // Handle pending files with single fabric data (like Jurly_Blanco_resumen.json)
            console.log(`🔍 [DELETE-PENDING] Archivo pending individual ${file.Key} pertenece a OC ${oc}`);
            
            const deleteCommand = new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: file.Key,
            });

            await s3Client.send(deleteCommand);
            deletedFiles.push(file.Key);
            totalDeletedFabrics += 1;
            
            console.log(`✅ [DELETE-PENDING] Archivo pending individual eliminado: ${file.Key}`);
          }
        }
      } catch (error) {
        console.error(`❌ [DELETE-PENDING] Error procesando archivo ${file.Key}:`, error);
        // Continue with other files even if one fails
      }
    }

    // Now process roll detail files in Catalogo_Rollos directory
    console.log(`🔍 [DELETE-PENDING] Buscando archivos de rollos para OC: ${oc}`);
    const rollsPrefix = "Inventario/Catalogo_Rollos/";
    
    const rollsListCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: rollsPrefix,
    });

    const rollsListResponse = await s3Client.send(rollsListCommand);
    const rollFiles = rollsListResponse.Contents || [];
    
    console.log(`📁 [DELETE-PENDING] Total de archivos en ${rollsPrefix}: ${rollFiles.length}`);

    // Process each roll file
    for (const rollFile of rollFiles) {
      if (!rollFile.Key || !rollFile.Key.endsWith(".json")) continue;

      // Skip backup files and other non-roll files
      if (rollFile.Key.includes("backup") || rollFile.Key.includes("_row")) continue;

      try {
        // Get roll file content
        const getRollCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: rollFile.Key,
        });

        const getRollResponse = await s3Client.send(getRollCommand);
        const rollFileContent = await getRollResponse.Body?.transformToString();
        
        if (!rollFileContent) continue;

        const rollData = JSON.parse(rollFileContent);

        // Check if this is an array of roll records
        if (Array.isArray(rollData)) {
          interface RollRecord {
            OC?: string;
            [key: string]: unknown;
          }

          // Filter rolls that match the OC
          const matchingRolls = rollData.filter((roll: RollRecord) => 
            roll.OC === oc || (oc === "SIN_OC" && !roll.OC)
          );

          if (matchingRolls.length > 0) {
            console.log(`🔍 [DELETE-PENDING] Archivo ${rollFile.Key} contiene ${matchingRolls.length} rollos de OC ${oc}`);
            
            // If ALL rolls in the file match the OC, delete the entire file
            if (matchingRolls.length === rollData.length) {
              const deleteRollCommand = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: rollFile.Key,
              });

              await s3Client.send(deleteRollCommand);
              deletedRollFiles.push(rollFile.Key);
              totalDeletedRolls += matchingRolls.length;
              
              console.log(`✅ [DELETE-PENDING] Archivo de rollos eliminado: ${rollFile.Key}`);
            } else {
              // If file contains rolls from multiple OCs, update it to remove only matching ones
              const remainingRolls = rollData.filter((roll: RollRecord) => 
                roll.OC !== oc && (oc !== "SIN_OC" || roll.OC)
              );

              // Re-upload the file with remaining rolls
              const putRollCommand = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: rollFile.Key,
                Body: JSON.stringify(remainingRolls, null, 2),
                ContentType: "application/json",
              });

              await s3Client.send(putRollCommand);
              totalDeletedRolls += matchingRolls.length;
              
              console.log(`📝 [DELETE-PENDING] Archivo de rollos actualizado: ${rollFile.Key} (removidos ${matchingRolls.length} rollos)`);
            }
          }
        } else if (rollData && typeof rollData === "object" && rollData.OC) {
          // Handle single roll record files
          if (rollData.OC === oc || (oc === "SIN_OC" && !rollData.OC)) {
            const deleteRollCommand = new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: rollFile.Key,
            });

            await s3Client.send(deleteRollCommand);
            deletedRollFiles.push(rollFile.Key);
            totalDeletedRolls += 1;
            
            console.log(`✅ [DELETE-PENDING] Archivo de rollo individual eliminado: ${rollFile.Key}`);
          }
        }
      } catch (error) {
        console.error(`❌ [DELETE-PENDING] Error procesando archivo de rollos ${rollFile.Key}:`, error);
        // Continue with other files even if one fails
      }
    }

    // Invalidate inventory cache
    if (deletedFiles.length > 0 || deletedRollFiles.length > 0 || totalDeletedFabrics > 0 || totalDeletedRolls > 0) {
      console.log("🔄 [DELETE-PENDING] Invalidando caché de inventario y rollos...");
      
      try {
        // Invalidate cache patterns
        await invalidateCachePattern("inventory");
        await invalidateCachePattern("pendingFiles");
        await invalidateCachePattern("get-rolls"); // Add roll cache invalidation
        
        // Warm the cache with fresh data
        await invalidateAndWarmInventory();
      } catch (error) {
        console.error(`❌ [DELETE-PENDING] Error invalidando caché:`, error);
      }
    }

    console.log(`✅ [DELETE-PENDING] Eliminación completada: ${deletedFiles.length} archivos de telas, ${deletedRollFiles.length} archivos de rollos, ${totalDeletedFabrics} telas, ${totalDeletedRolls} rollos`);

    const totalItems = totalDeletedFabrics + totalDeletedRolls;
    const message = totalDeletedRolls > 0 
      ? `Se eliminaron ${totalDeletedFabrics} telas y ${totalDeletedRolls} rollos de la OC ${oc}` 
      : `Se eliminaron ${totalDeletedFabrics} telas de la OC ${oc}`;

    return NextResponse.json({
      success: true,
      message,
      deletedFiles: deletedFiles.length,
      deletedRollFiles: deletedRollFiles.length,
      totalDeletedFabrics,
      totalDeletedRolls,
      totalDeletedItems: totalItems,
      oc
    });

  } catch (error) {
    console.error("❌ [DELETE-PENDING] Error general:", error);
    return NextResponse.json(
      { error: "Error al eliminar los registros pending" },
      { status: 500 }
    );
  }
}