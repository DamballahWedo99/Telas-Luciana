import * as dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno ANTES de importar cualquier módulo que las use
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Ahora importar Redis después de cargar las variables
const { cacheRedis } = require("../src/lib/redis");

async function cleanUserCache() {
  console.log("🧹 Limpiando caché viejo de usuarios...");
  
  try {
    // Buscar todas las keys de usuarios
    const patterns = [
      "cache:api:users:*",
      "cache:api:users:pathname:*",
    ];
    
    let totalDeleted = 0;
    
    for (const pattern of patterns) {
      console.log(`\n🔍 Buscando keys con patrón: ${pattern}`);
      
      // Obtener todas las keys que coincidan
      const keys = await cacheRedis.keys(pattern);
      
      if (keys.length > 0) {
        console.log(`📊 Encontradas ${keys.length} keys`);
        
        for (const key of keys) {
          // Obtener TTL actual
          const ttl = await cacheRedis.ttl(key);
          
          // Si el TTL es mayor a 1 hora (3600 segundos), es una key vieja
          if (ttl > 3600) {
            console.log(`  ❌ Eliminando key vieja: ${key} (TTL: ${ttl}s = ${Math.round(ttl/3600)}h)`);
            await cacheRedis.del(key);
            totalDeleted++;
          } else if (ttl > 0) {
            console.log(`  ✅ Key correcta: ${key} (TTL: ${ttl}s = ${Math.round(ttl/60)}min)`);
          }
        }
      } else {
        console.log("  No se encontraron keys");
      }
    }
    
    console.log(`\n✨ Limpieza completada. ${totalDeleted} keys eliminadas.`);
    
    // Verificar las keys restantes
    console.log("\n📋 Estado actual del caché de usuarios:");
    const remainingKeys = await cacheRedis.keys("cache:api:users:*");
    
    if (remainingKeys.length > 0) {
      for (const key of remainingKeys) {
        const ttl = await cacheRedis.ttl(key);
        console.log(`  - ${key}: TTL ${ttl}s (${Math.round(ttl/60)}min)`);
      }
    } else {
      console.log("  No hay keys de usuarios en caché");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error limpiando caché:", error);
    process.exit(1);
  }
}

cleanUserCache();