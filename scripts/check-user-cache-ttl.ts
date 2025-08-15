import * as dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { cacheRedis } = require("../src/lib/redis");

async function checkUserCacheTTL() {
  console.log("🔍 Verificando TTL del caché de usuarios...\n");
  
  try {
    // Buscar todas las keys de usuarios
    const keys = await cacheRedis.keys("cache:api:users:*");
    
    if (keys.length > 0) {
      console.log(`📊 Encontradas ${keys.length} keys de usuarios:\n`);
      
      for (const key of keys) {
        const ttl = await cacheRedis.ttl(key);
        
        if (ttl > 0) {
          const hours = Math.floor(ttl / 3600);
          const minutes = Math.floor((ttl % 3600) / 60);
          const seconds = ttl % 60;
          
          let status = "✅";
          let comment = "";
          
          if (ttl > 3600) {
            status = "⚠️";
            comment = " (DEMASIADO ALTO - debería ser 5 min)";
          } else if (ttl <= 300) {
            status = "✅";
            comment = " (CORRECTO - 5 min o menos)";
          } else {
            status = "⚠️";
            comment = " (Mayor a 5 min)";
          }
          
          console.log(`${status} ${key}`);
          console.log(`   TTL: ${ttl}s (${hours}h ${minutes}m ${seconds}s)${comment}\n`);
        } else if (ttl === -1) {
          console.log(`❌ ${key}`);
          console.log(`   TTL: Sin expiración (permanente)\n`);
        } else if (ttl === -2) {
          console.log(`❓ ${key}`);
          console.log(`   Key no existe\n`);
        }
      }
    } else {
      console.log("📭 No hay keys de usuarios en caché actualmente");
      console.log("\n💡 Tip: Intenta hacer una petición a la API de usuarios primero:");
      console.log("   curl http://localhost:3000/api/users");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error verificando caché:", error);
    process.exit(1);
  }
}

checkUserCacheTTL();