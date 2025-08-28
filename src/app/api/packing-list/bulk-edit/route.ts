import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateCachePattern } from "@/lib/cache-middleware";
import type { PackingListRoll } from "../../../../../types/types";

const s3Client = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

interface BulkEditChange {
  type: 'add' | 'update' | 'delete';
  rollId: string;
  data: Partial<PackingListRoll>;
  originalData?: PackingListRoll;
}

interface BulkEditRequest {
  changes: BulkEditChange[];
}

async function getAllPackingListFiles(): Promise<_Object[]> {
  try {
    let allFiles: _Object[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        Prefix: "Inventario/Catalogo_Rollos/",
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const listResponse = await s3Client.send(listCommand);

      if (listResponse.Contents) {
        allFiles = allFiles.concat(listResponse.Contents);
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return allFiles.filter((item) => {
      const key = item.Key || "";
      return (
        key.endsWith(".json") &&
        !key.includes("backup") &&
        !key.includes("_row") &&
        key.includes("detalle_")
      );
    });
  } catch (error) {
    console.error("❌ Error buscando archivos packing list:", error);
    return [];
  }
}

async function readPackingListFile(fileKey: string): Promise<PackingListRoll[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    if (!bodyString) return [];
    
    const data = JSON.parse(bodyString);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`❌ Error leyendo archivo ${fileKey}:`, error);
    return [];
  }
}

async function findFilesForChanges(changes: BulkEditChange[], files: _Object[]): Promise<Map<string, string>> {
  const ocToFileMap = new Map<string, string>();
  
  // Extract unique OCs from changes with debug logging
  const uniqueOCs = new Set<string>();
  changes.forEach(change => {
    if (change.originalData?.OC) {
      uniqueOCs.add(change.originalData.OC);
    }
    if (change.data.OC) {
      uniqueOCs.add(change.data.OC);
    }
  });


  // Find files for each OC
  for (const oc of uniqueOCs) {
    let foundForOC = false;
    
    for (const file of files) {
      if (!file.Key) continue;

      try {
        const rolls = await readPackingListFile(file.Key);
        
        const hasOC = rolls.some(roll => 
          roll.OC && roll.OC.trim().toLowerCase() === oc.toLowerCase()
        );

        if (hasOC) {
          ocToFileMap.set(oc, file.Key);
          foundForOC = true;
          break;
        }
      } catch (error) {
        console.error(`Error processing ${file.Key}:`, error);
        continue;
      }
    }
    
    if (!foundForOC) {
      console.warn(`OC "${oc}" not found in any file`);
    }
  }

  return ocToFileMap;
}

function validateRollData(roll: Partial<PackingListRoll>): { valid: boolean; error?: string } {
  // For partial data, only validate what's provided
  if (roll.unidad && roll.unidad !== "KG" && roll.unidad !== "MTS") {
    return { valid: false, error: `Unidad inválida: debe ser KG o MTS` };
  }

  if (roll.cantidad !== undefined && (typeof roll.cantidad !== "number" || roll.cantidad < 0)) {
    return { valid: false, error: `Cantidad inválida: debe ser un número mayor o igual a 0` };
  }

  if (roll.status) {
    const validStatuses = ["pending", "active", "sold", "returned"];
    if (!validStatuses.includes(roll.status)) {
      return { valid: false, error: `Status inválido: debe ser uno de ${validStatuses.join(", ")}` };
    }
  }

  return { valid: true };
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "auth",
      message: "Demasiadas actualizaciones masivas. Espera antes de continuar.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Only admins can do bulk edits
    if (session.user.role !== "admin" && session.user.role !== "major_admin") {
      return NextResponse.json(
        { error: "No autorizado para realizar ediciones masivas" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as BulkEditRequest;
    const { changes } = body;

    if (!changes || !Array.isArray(changes)) {
      return NextResponse.json(
        { error: "Cambios son requeridos y deben ser un array" },
        { status: 400 }
      );
    }

    if (changes.length === 0) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos un cambio" },
        { status: 400 }
      );
    }

    // Validate all change data
    for (const change of changes) {
      if (!change.type || !['add', 'update', 'delete'].includes(change.type)) {
        return NextResponse.json(
          { error: `Tipo de cambio inválido: ${change.type}` },
          { status: 400 }
        );
      }

      if (!change.rollId) {
        return NextResponse.json(
          { error: "rollId es requerido para cada cambio" },
          { status: 400 }
        );
      }

      const validation = validateRollData(change.data);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Datos inválidos para rollo ${change.rollId}: ${validation.error}` },
          { status: 400 }
        );
      }
    }


    const allFiles = await getAllPackingListFiles();

    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron archivos de packing list" },
        { status: 404 }
      );
    }

    const ocToFileMap = await findFilesForChanges(changes, allFiles);

    if (ocToFileMap.size === 0) {
      return NextResponse.json(
        { error: "No se encontraron archivos para los cambios especificados" },
        { status: 404 }
      );
    }

    const processedFiles = new Set<string>();
    const results: { [fileKey: string]: { changesApplied: number; totalChanges: number; backupFile: string } } = {};

    // Process each file
    for (const [oc, fileKey] of ocToFileMap.entries()) {
      if (processedFiles.has(fileKey)) continue;
      

      // Read the current file
      const currentRolls = await readPackingListFile(fileKey);

      if (currentRolls.length === 0) {
        console.warn(`Archivo vacío: ${fileKey}`);
        continue;
      }

      // Create a backup of the original file
      const timestamp = Date.now();
      const fileName = fileKey.split("/").pop()?.replace(".json", "");
      const backupFileName = `${fileName}_backup_bulk_${timestamp}.json`;

      const backupCommand = new PutObjectCommand({
        Bucket: "telas-luciana",
        Key: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
        Body: JSON.stringify(currentRolls, null, 2),
        ContentType: "application/json",
        Metadata: {
          "backup-reason": "pre-bulk-edit-backup",
          "backup-date": new Date().toISOString(),
          "backed-up-by": session.user.email || "",
        },
      });

      await s3Client.send(backupCommand);

      // Get changes for this file
      const fileChanges = changes.filter(change => 
        (change.originalData?.OC && change.originalData.OC.toLowerCase() === oc.toLowerCase()) ||
        (change.data.OC && change.data.OC.toLowerCase() === oc.toLowerCase())
      );

      // Apply changes
      const updatedRolls = [...currentRolls];
      let changesApplied = 0;

      for (const change of fileChanges) {
        console.log(`🔄 [BULK-EDIT-DEBUG] Processing change:`, {
          type: change.type,
          rollId: change.rollId,
          dataKeys: Object.keys(change.data || {}),
          changeData: change.data,
          hasOriginalData: !!change.originalData,
          originalRolloId: change.originalData?.rollo_id,
          originalOC: change.originalData?.OC
        });
        
        switch (change.type) {
          case 'update': {
            console.log(`🔍 [BULK-EDIT-DEBUG] Looking for roll to update: ${change.rollId}`);
            console.log(`🔍 [BULK-EDIT-DEBUG] Total rolls in file: ${updatedRolls.length}`);
            
            // CRITICAL VALIDATION: If originalData is provided, validate it matches what user expects
            if (change.originalData) {
              console.log(`🛡️ [BULK-EDIT-VALIDATION] Validating originalData matches user expectations:`, {
                rollId: change.rollId,
                expectedTela: change.originalData.tela,
                expectedColor: change.originalData.color,
                expectedLote: change.originalData.lote,
                expectedOC: change.originalData.OC
              });
            }
            
            // Log first few rolls for debugging
            const sampleRolls = updatedRolls.slice(0, 3).map((roll, index) => ({
              index,
              rollo_id: roll.rollo_id,
              OC: roll.OC,
              tela: roll.tela,
              color: roll.color,
              lote: roll.lote,
              compositeId: `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}`,
              matchesRollId: roll.rollo_id === change.rollId,
              matchesComposite: `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}` === change.rollId
            }));
            console.log(`🔍 [BULK-EDIT-DEBUG] Sample rolls for matching:`, sampleRolls);
            
            let foundRoll: PackingListRoll | null = null;
            let foundIndex = -1;
            let matchMethod = '';
            
            // METHOD 1: Try composite ID match first (most specific)
            if (change.rollId.includes('_')) {
              foundIndex = updatedRolls.findIndex(roll => {
                const compositeId = `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}`;
                return compositeId === change.rollId;
              });
              if (foundIndex !== -1) {
                foundRoll = updatedRolls[foundIndex];
                matchMethod = 'composite_id';
                console.log(`✅ [BULK-EDIT-DEBUG] Match found by composite ID: ${change.rollId}`);
              }
            }
            
            // METHOD 2: Try direct rollo_id match (if composite didn't work)
            if (foundIndex === -1) {
              foundIndex = updatedRolls.findIndex(roll => roll.rollo_id === change.rollId);
              if (foundIndex !== -1) {
                foundRoll = updatedRolls[foundIndex];
                matchMethod = 'direct_rollo_id';
                console.log(`✅ [BULK-EDIT-DEBUG] Match found by rollo_id: ${foundRoll.rollo_id}`);
              }
            }
            
            // METHOD 3: Try originalData match (fallback)
            if (foundIndex === -1 && change.originalData) {
              foundIndex = updatedRolls.findIndex(roll => roll.rollo_id === change.originalData!.rollo_id);
              if (foundIndex !== -1) {
                foundRoll = updatedRolls[foundIndex];
                matchMethod = 'original_data';
                console.log(`✅ [BULK-EDIT-DEBUG] Match found by original rollo_id: ${foundRoll.rollo_id}`);
              }
            }
            
            if (foundRoll && foundIndex !== -1) {
              // CRITICAL VALIDATION: Verify the found roll matches user expectations
              if (change.originalData) {
                const dataMatches = (
                  foundRoll.tela === change.originalData.tela &&
                  foundRoll.color === change.originalData.color &&
                  foundRoll.lote === change.originalData.lote &&
                  foundRoll.OC === change.originalData.OC
                );
                
                if (!dataMatches) {
                  console.error(`🚨 [BULK-EDIT-CRITICAL] DATA INTEGRITY VIOLATION DETECTED!`);
                  console.error(`🚨 User expects to edit:`, {
                    tela: change.originalData.tela,
                    color: change.originalData.color,
                    lote: change.originalData.lote,
                    OC: change.originalData.OC,
                    rollId: change.rollId
                  });
                  console.error(`🚨 But backend found:`, {
                    tela: foundRoll.tela,
                    color: foundRoll.color,
                    lote: foundRoll.lote,
                    OC: foundRoll.OC,
                    rollo_id: foundRoll.rollo_id
                  });
                  console.error(`🚨 Match method: ${matchMethod}`);
                  
                  // REFUSE TO UPDATE - This prevents accidental data corruption
                  console.error(`❌ [BULK-EDIT-CRITICAL] Refusing to update roll due to data integrity violation`);
                  
                  // Continue to next change instead of updating wrong data
                  continue;
                }
              }
              
              // Data validation passed - proceed with update
              const originalRoll = { ...foundRoll };
              updatedRolls[foundIndex] = {
                ...foundRoll,
                ...change.data,
              };
              changesApplied++;
              
              console.log(`✅ [BULK-EDIT-DEBUG] Successfully updated roll at index ${foundIndex} (method: ${matchMethod}):`, {
                rollId: change.rollId,
                beforeUpdate: {
                  tela: originalRoll.tela,
                  color: originalRoll.color,
                  lote: originalRoll.lote,
                  cantidad: originalRoll.cantidad,
                  status: originalRoll.status,
                  unidad: originalRoll.unidad
                },
                afterUpdate: {
                  cantidad: updatedRolls[foundIndex].cantidad,
                  status: updatedRolls[foundIndex].status,
                  unidad: updatedRolls[foundIndex].unidad
                },
                changeData: change.data,
                dataValidationPassed: true
              });
            } else {
              console.error(`❌ [BULK-EDIT-DEBUG] Roll NOT FOUND for update:`, {
                searchId: change.rollId,
                searchMethods: [
                  'Composite ID match',
                  'Direct rollo_id match',
                  'Original data rollo_id match'
                ],
                hasOriginalData: !!change.originalData,
                availableRollIds: updatedRolls.slice(0, 10).map(r => r.rollo_id),
                availableCompositeIds: updatedRolls.slice(0, 10).map(r => `${r.OC}_${r.tela}_${r.color}_${r.lote}_${r.rollo_id}`)
              });
            }
            break;
          }
          
          case 'delete': {
            console.log(`🗑️ [BULK-EDIT-DEBUG] Looking for roll to delete: ${change.rollId}`);
            
            let foundRoll: PackingListRoll | null = null;
            let foundIndex = -1;
            let matchMethod = '';
            
            // METHOD 1: Try composite ID match first (most specific)
            if (change.rollId.includes('_')) {
              foundIndex = updatedRolls.findIndex(roll => {
                const compositeId = `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}`;
                return compositeId === change.rollId;
              });
              if (foundIndex !== -1) {
                foundRoll = updatedRolls[foundIndex];
                matchMethod = 'composite_id';
              }
            }
            
            // METHOD 2: Try direct rollo_id match (if composite didn't work)
            if (foundIndex === -1) {
              foundIndex = updatedRolls.findIndex(roll => roll.rollo_id === change.rollId);
              if (foundIndex !== -1) {
                foundRoll = updatedRolls[foundIndex];
                matchMethod = 'direct_rollo_id';
              }
            }
            
            // METHOD 3: Try originalData match (fallback)
            if (foundIndex === -1 && change.originalData) {
              foundIndex = updatedRolls.findIndex(roll => roll.rollo_id === change.originalData!.rollo_id);
              if (foundIndex !== -1) {
                foundRoll = updatedRolls[foundIndex];
                matchMethod = 'original_data';
              }
            }
            
            if (foundRoll && foundIndex !== -1) {
              // CRITICAL VALIDATION: Verify the found roll matches user expectations
              if (change.originalData) {
                const dataMatches = (
                  foundRoll.tela === change.originalData.tela &&
                  foundRoll.color === change.originalData.color &&
                  foundRoll.lote === change.originalData.lote &&
                  foundRoll.OC === change.originalData.OC
                );
                
                if (!dataMatches) {
                  console.error(`🚨 [BULK-EDIT-CRITICAL] DATA INTEGRITY VIOLATION DETECTED during DELETE!`);
                  console.error(`🚨 User expects to delete:`, {
                    tela: change.originalData.tela,
                    color: change.originalData.color,
                    lote: change.originalData.lote,
                    OC: change.originalData.OC,
                    rollId: change.rollId
                  });
                  console.error(`🚨 But backend found:`, {
                    tela: foundRoll.tela,
                    color: foundRoll.color,
                    lote: foundRoll.lote,
                    OC: foundRoll.OC,
                    rollo_id: foundRoll.rollo_id
                  });
                  console.error(`🚨 Match method: ${matchMethod}`);
                  
                  // REFUSE TO DELETE - This prevents accidental data deletion
                  console.error(`❌ [BULK-EDIT-CRITICAL] Refusing to delete roll due to data integrity violation`);
                  
                  // Continue to next change instead of deleting wrong data
                  continue;
                }
              }
              
              // Data validation passed - proceed with deletion
              const rollToDelete = { ...foundRoll };
              updatedRolls.splice(foundIndex, 1);
              changesApplied++;
              
              console.log(`🗑️ [BULK-EDIT-DEBUG] Successfully deleted roll at index ${foundIndex} (method: ${matchMethod}):`, {
                rollId: change.rollId,
                deletedRoll: {
                  tela: rollToDelete.tela,
                  color: rollToDelete.color,
                  lote: rollToDelete.lote,
                  rollo_id: rollToDelete.rollo_id,
                  cantidad: rollToDelete.cantidad,
                  status: rollToDelete.status
                },
                dataValidationPassed: true
              });
            } else {
              console.error(`❌ [BULK-EDIT-DEBUG] Roll NOT FOUND for deletion:`, {
                searchId: change.rollId,
                searchMethods: [
                  'Composite ID match',
                  'Direct rollo_id match',
                  'Original data rollo_id match'
                ],
                hasOriginalData: !!change.originalData,
                availableRollIds: updatedRolls.slice(0, 10).map(r => r.rollo_id)
              });
            }
            break;
          }
          
          case 'add': {
            if (change.data as PackingListRoll) {
              updatedRolls.push(change.data as PackingListRoll);
              changesApplied++;
              console.log(`➕ [BULK-EDIT] Agregado rollo ${change.rollId}`);
            }
            break;
          }
        }
      }

      // Save the updated file with extensive debugging
      console.log(`💾 [BULK-EDIT-DEBUG] Preparing to save file: ${fileKey}`);
      console.log(`💾 [BULK-EDIT-DEBUG] File will contain ${updatedRolls.length} rolls`);
      console.log(`💾 [BULK-EDIT-DEBUG] Applied ${changesApplied} changes out of ${fileChanges.length} requested`);
      
      const fileContent = JSON.stringify(updatedRolls, null, 2);
      console.log(`💾 [BULK-EDIT-DEBUG] File content size: ${fileContent.length} characters`);
      
      // Log sample of updated data
      const sampleUpdatedRolls = updatedRolls.slice(0, 3).map(roll => ({
        OC: roll.OC,
        tela: roll.tela,
        color: roll.color,
        lote: roll.lote,
        rollo_id: roll.rollo_id,
        cantidad: roll.cantidad,
        status: roll.status,
        unidad: roll.unidad
      }));
      console.log(`💾 [BULK-EDIT-DEBUG] Sample of data being saved:`, sampleUpdatedRolls);

      const putCommand = new PutObjectCommand({
        Bucket: "telas-luciana",
        Key: fileKey,
        Body: fileContent,
        ContentType: "application/json",
        Metadata: {
          "last-updated": new Date().toISOString(),
          "updated-by": session.user.email || "",
          "operation": "bulk-edit",
          "changes-applied": changesApplied.toString(),
        },
      });

      console.log(`💾 [BULK-EDIT-DEBUG] Sending PUT command to S3...`);
      const putResult = await s3Client.send(putCommand);
      console.log(`💾 [BULK-EDIT-DEBUG] S3 PUT result:`, {
        ETag: putResult.ETag,
        VersionId: putResult.VersionId,
        statusCode: putResult.$metadata.httpStatusCode
      });
      
      // Verify the save by reading back the file
      console.log(`🔍 [BULK-EDIT-DEBUG] Verifying save by reading file back...`);
      try {
        const verifyCommand = new GetObjectCommand({
          Bucket: "telas-luciana",
          Key: fileKey,
        });
        const verifyResponse = await s3Client.send(verifyCommand);
        const verifyBody = await verifyResponse.Body?.transformToString();
        
        if (verifyBody) {
          const verifyData = JSON.parse(verifyBody);
          console.log(`✅ [BULK-EDIT-DEBUG] File verification successful:`, {
            rollCount: verifyData.length,
            firstRoll: verifyData[0] ? {
              rollo_id: verifyData[0].rollo_id,
              cantidad: verifyData[0].cantidad,
              status: verifyData[0].status
            } : null
          });
          
          // Check if our specific changes are present
          const changedRollsVerification = fileChanges.filter(change => change.type === 'update').map(change => {
            const verifiedRoll = verifyData.find((roll: PackingListRoll) => {
              return roll.rollo_id === change.rollId || 
                     (change.originalData && roll.rollo_id === change.originalData.rollo_id) ||
                     `${roll.OC}_${roll.tela}_${roll.color}_${roll.lote}_${roll.rollo_id}` === change.rollId;
            });
            
            return {
              changeRollId: change.rollId,
              found: !!verifiedRoll,
              expectedData: change.data,
              actualData: verifiedRoll ? {
                cantidad: verifiedRoll.cantidad,
                status: verifiedRoll.status,
                unidad: verifiedRoll.unidad
              } : null,
              matches: verifiedRoll ? Object.keys(change.data).every(key => {
                const rollValue = (verifiedRoll as Record<string, unknown>)[key];
                const changeValue = (change.data as Record<string, unknown>)[key];
                return rollValue === changeValue;
              }) : false
            };
          });
          
          console.log(`🔍 [BULK-EDIT-DEBUG] Change verification:`, changedRollsVerification);
          
          const successfulChanges = changedRollsVerification.filter(v => v.found && v.matches).length;
          console.log(`✅ [BULK-EDIT-DEBUG] Verification summary: ${successfulChanges}/${changedRollsVerification.length} changes verified in saved file`);
          
        } else {
          console.error(`❌ [BULK-EDIT-DEBUG] File verification failed - empty response body`);
        }
      } catch (verifyError) {
        console.error(`❌ [BULK-EDIT-DEBUG] File verification failed:`, verifyError);
      }

      results[fileKey] = {
        changesApplied,
        totalChanges: fileChanges.length,
        backupFile: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      };

      processedFiles.add(fileKey);
    }

    // Invalidate related caches
    await Promise.all([
      invalidateCachePattern("cache:api:s3:get-rolls*"),
      invalidateCachePattern("cache:api:packing-list:available-orders*"),
      invalidateCachePattern("cache:api:packing-list:order-rolls*"),
    ]);

    const totalChangesApplied = Object.values(results).reduce((sum: number, result) => sum + result.changesApplied, 0);

    console.log(`✅ [BULK-EDIT-DEBUG] Final summary for user ${session.user.email}:`, {
      changesRequested: changes.length,
      changesApplied: totalChangesApplied,
      filesProcessed: processedFiles.size,
      processedFilesList: Array.from(processedFiles),
      detailedResults: results,
      cacheInvalidated: true,
      timestamp: new Date().toISOString(),
    });

    const responseData = {
      success: true,
      message: `Cambios masivos aplicados correctamente`,
      data: {
        changesRequested: changes.length,
        changesApplied: totalChangesApplied,
        filesProcessed: processedFiles.size,
        results,
      },
      cache: { 
        invalidated: true, 
        patterns: ["get-rolls", "available-orders", "order-rolls"] 
      },
    };

    console.log(`📤 [BULK-EDIT-DEBUG] Sending response:`, {
      success: responseData.success,
      message: responseData.message,
      changesRequested: responseData.data.changesRequested,
      changesApplied: responseData.data.changesApplied,
      filesProcessed: responseData.data.filesProcessed,
      cacheInvalidated: responseData.cache.invalidated
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("❌ [BULK-EDIT] Error en edición masiva:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor en edición masiva",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}