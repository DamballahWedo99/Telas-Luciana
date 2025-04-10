import { useEffect, useState, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

/**
 * Hook que verifica si el usuario actual sigue existiendo en la base de datos,
 * pero de forma optimizada: solo en momentos clave en lugar de por polling.
 */
export function useUserVerification() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  // Referencia para controlar la frecuencia de verificaciones
  const lastCheckRef = useRef(0);
  // Referencia para las rutas ya verificadas
  const checkedPathsRef = useRef(new Set());
  // Rastrear si es la primera carga
  const isInitialMountRef = useRef(true);

  // Función para verificar si el usuario existe
  const checkUserExists = useCallback(
    async (source: "pathname" | "focus" | "mount") => {
      // Evitar verificaciones duplicadas o muy frecuentes
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheckRef.current;
      const MIN_CHECK_INTERVAL = 5000; // 5 segundos mínimo entre verificaciones

      // Verificar condiciones para omitir la verificación
      if (
        !session?.user?.id ||
        isCheckingUser ||
        status !== "authenticated" ||
        (timeSinceLastCheck < MIN_CHECK_INTERVAL && !isInitialMountRef.current)
      ) {
        console.log(`Verificación omitida (${source}):`, {
          tieneId: !!session?.user?.id,
          isCheckingUser,
          status,
          segundosDesdeÚltimaVerificación: timeSinceLastCheck / 1000,
        });
        return;
      }

      try {
        console.log(
          `Iniciando verificación de usuario (${source}):`,
          session.user.id
        );
        setIsCheckingUser(true);
        lastCheckRef.current = now;

        // Si es una verificación por cambio de ruta, registrar que ya verificamos esta ruta
        if (source === "pathname" && pathname) {
          checkedPathsRef.current.add(pathname);
        }

        // Marcar que ya pasamos el montaje inicial
        if (isInitialMountRef.current) {
          isInitialMountRef.current = false;
        }

        const response = await fetch("/api/users/verify", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        console.log("Respuesta de verificación:", data);

        if (!data.exists) {
          console.log(
            "Usuario no encontrado en la base de datos. Cerrando sesión..."
          );
          await signOut({
            redirect: true,
            callbackUrl: "/login?error=AccountDeleted",
          });
        }
      } catch (error) {
        console.error("Error verificando existencia de usuario:", error);
        // En caso de error, no cerramos sesión para evitar problemas técnicos
      } finally {
        setIsCheckingUser(false);
      }
    },
    [session?.user?.id, status, pathname]
  ); // Reducir dependencias

  // Verificar cuando cambia la ruta (pero solo para rutas nuevas)
  useEffect(() => {
    if (
      pathname &&
      status === "authenticated" &&
      !checkedPathsRef.current.has(pathname)
    ) {
      checkUserExists("pathname");
    }
  }, [pathname, checkUserExists, status]);

  useEffect(() => {
    const handleFocus = () => {
      if (status === "authenticated") {
        checkUserExists("focus");
      }
    };

    window.addEventListener("focus", handleFocus);

    if (status === "authenticated" && isInitialMountRef.current) {
      checkUserExists("mount");
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkUserExists, status]);

  return null;
}
