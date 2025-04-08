const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const adminExists = await prisma.user.findFirst({
      where: { role: "admin" },
    });

    if (adminExists) {
      console.log("Un usuario administrador ya existe en la base de datos.");
      return;
    }

    const hashedPassword = await bcrypt.hash("Admin123!", 10);

    const admin = await prisma.user.create({
      data: {
        name: "Administrador",
        email: "admin@example.com",
        password: hashedPassword,
        role: "admin",
        isActive: true,
      },
    });

    console.log(`✅ Usuario administrador creado con ID: ${admin.id}`);
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔑 Contraseña: Admin123! (cámbiala después del primer login)`);
  } catch (error) {
    console.error("Error al crear administrador:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
