const https = require("https");
const http = require("http");

// Configuración
const DOMAIN = process.env.TEST_DOMAIN || "http://localhost:3000"; // Cambiar a localhost por defecto
const CRON_SECRET =
  "1631a01cc4349e0c632253bff409cd5af18577c83b0484cb15f2db58bc78b88cca1cf47d5605383bcb8cd6610c5736f169924444ad7796d908ec3f05b09353e7";

// Colores para console
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

// Función para hacer requests HTTP con seguimiento de redirects
function makeRequest(url, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    // Prevenir loops infinitos de redirect
    if (redirectCount > 5) {
      reject(new Error("Too many redirects"));
      return;
    }

    const urlObj = new URL(url);
    const lib = urlObj.protocol === "https:" ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = lib.request(requestOptions, (res) => {
      // Seguir redirects (301, 302, 307, 308)
      if (
        [301, 302, 307, 308].includes(res.statusCode) &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, url);
        console.log(`   🔄 Redirect ${res.statusCode}: ${redirectUrl.href}`);

        // IMPORTANTE: Preservar headers en redirects
        const redirectOptions = {
          ...options,
          headers: { ...options.headers }, // Copiar headers para el redirect
        };

        return makeRequest(redirectUrl.href, redirectOptions, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }

      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData,
            headers: res.headers,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers,
          });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Función para colorear texto
function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Tests
async function runTests() {
  console.log(colorize("🧪 Iniciando tests del sistema de cron...", "blue"));
  console.log(colorize(`🌐 Dominio: ${DOMAIN}`, "blue"));
  console.log(
    colorize(
      `🔑 Cron Secret: ${CRON_SECRET ? "Configurado ✅" : "No configurado ❌"}`,
      "blue"
    )
  );
  console.log("");

  // Test de conectividad básica
  console.log(colorize("🔍 Test de conectividad básica...", "yellow"));
  try {
    const basicTest = await makeRequest(`${DOMAIN}/`, { method: "GET" });
    console.log(
      colorize(`✅ Sitio accesible: HTTP ${basicTest.status}`, "green")
    );
  } catch (error) {
    console.log(colorize(`❌ Error de conectividad: ${error.message}`, "red"));
    console.log(
      colorize(
        "   Verifica que el sitio esté accesible desde tu ubicación",
        "yellow"
      )
    );
    return;
  }
  console.log("");

  const tests = [
    {
      name: "Test 1: Verificando acceso interno a inventario",
      url: `${DOMAIN}/api/s3/inventario?year=2025&month=06`,
      method: "GET",
      headers: {
        "x-internal-request": "true",
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      expectedStatus: 200,
    },
    {
      name: "Test 2: Verificando que acceso sin headers internos falle",
      url: `${DOMAIN}/api/s3/inventario?year=2025&month=06`,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatus: 401,
    },
    {
      name: "Test 3: Verificando endpoint del scheduler",
      url: `${DOMAIN}/api/cron/scheduler`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      expectedStatus: 200,
    },
    {
      name: "Test 4: Probando endpoint de weekly-inventory",
      url: `${DOMAIN}/api/cron/weekly-inventory`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      expectedStatus: [200, 429], // 429 es rate limit, también válido
    },
    {
      name: "Test 5a: Header capitalizado",
      url: `${DOMAIN}/api/s3/inventario?year=2025&month=06`,
      method: "GET",
      headers: {
        "X-Internal-Request": "true",
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      expectedStatus: 200,
    },
    {
      name: "Test 5b: Header en mayúsculas",
      url: `${DOMAIN}/api/s3/inventario?year=2025&month=06`,
      method: "GET",
      headers: {
        "X-INTERNAL-REQUEST": "true",
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      expectedStatus: 200,
    },
  ];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(colorize(`${test.name}...`, "yellow"));

    // Debug: mostrar headers que se envían
    console.log(
      `   📤 Headers enviados: ${JSON.stringify(test.headers, null, 2)}`
    );

    try {
      const response = await makeRequest(test.url, {
        method: test.method,
        headers: test.headers,
      });

      const expectedStatuses = Array.isArray(test.expectedStatus)
        ? test.expectedStatus
        : [test.expectedStatus];

      if (expectedStatuses.includes(response.status)) {
        console.log(colorize(`✅ PASÓ: HTTP ${response.status}`, "green"));

        if (response.status === 200 && typeof response.data === "object") {
          // Mostrar solo un resumen de la respuesta para mantener legibilidad
          const summary = JSON.stringify(response.data, null, 2);
          if (summary.length > 300) {
            console.log("   Respuesta:", summary.slice(0, 300) + "...");
          } else {
            console.log("   Respuesta:", summary);
          }
        } else if (response.status === 429) {
          console.log(
            colorize("   ⚠️  Rate Limited: Demasiadas solicitudes", "yellow")
          );
          if (typeof response.data === "object") {
            console.log(
              "   Mensaje:",
              response.data.message || response.data.error
            );
          }
        }
      } else {
        console.log(
          colorize(
            `❌ FALLÓ: HTTP ${response.status} (esperado: ${test.expectedStatus})`,
            "red"
          )
        );
        if (typeof response.data === "object") {
          console.log("   Error:", JSON.stringify(response.data, null, 2));
        } else {
          console.log("   Respuesta:", response.data);
        }
      }
    } catch (error) {
      console.log(colorize(`❌ ERROR: ${error.message}`, "red"));
    }

    console.log("");
  }

  console.log(colorize("🏁 Tests completados", "blue"));
  console.log("");
  console.log(
    colorize("💡 Para ejecutar manualmente el reporte semanal:", "yellow")
  );
  console.log(`curl -X POST ${DOMAIN}/api/cron/weekly-inventory \\`);
  console.log(`  -H "Authorization: Bearer ${CRON_SECRET}"`);
  console.log("");
  console.log(colorize("💡 Para iniciar el scheduler automático:", "yellow"));
  console.log(`curl -X POST ${DOMAIN}/api/cron/scheduler \\`);
  console.log(`  -H "Authorization: Bearer ${CRON_SECRET}"`);
}

// Ejecutar tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
