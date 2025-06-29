import { useEffect, useState, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export function useUserVerification() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  const lastCheckRef = useRef(0);
  const checkedPathsRef = useRef(new Set());
  const isInitialMountRef = useRef(true);
  const hasPerformedInitialCheck = useRef(false);

  const checkUserExists = useCallback(
    async (source: "pathname" | "focus" | "mount") => {
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheckRef.current;
      const MIN_CHECK_INTERVAL = 5000;

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

      if (source === "mount" && !hasPerformedInitialCheck.current) {
        const loginTime = sessionStorage.getItem("lastLoginTime");
        if (loginTime) {
          const timeSinceLogin = now - parseInt(loginTime);
          if (timeSinceLogin < 3000) {
            console.log(
              `Esperando antes de primera verificación: ${
                3000 - timeSinceLogin
              }ms`
            );
            setTimeout(() => {
              hasPerformedInitialCheck.current = true;
              checkUserExists("mount");
            }, 3000 - timeSinceLogin);
            return;
          }
        }
        hasPerformedInitialCheck.current = true;
      }

      try {
        console.log(
          `Iniciando verificación de usuario (${source}):`,
          session.user.id
        );
        setIsCheckingUser(true);
        lastCheckRef.current = now;

        if (source === "pathname" && pathname) {
          checkedPathsRef.current.add(pathname);
        }

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
          sessionStorage.removeItem("lastLoginTime");
          await signOut({
            redirect: true,
            callbackUrl: "/login?error=AccountDeleted",
          });
        }
      } catch (error) {
        console.error("Error verificando existencia de usuario:", error);
      } finally {
        setIsCheckingUser(false);
      }
    },
    [session?.user?.id, status, pathname, isCheckingUser]
  );

  useEffect(() => {
    if (
      pathname &&
      status === "authenticated" &&
      !checkedPathsRef.current.has(pathname) &&
      hasPerformedInitialCheck.current
    ) {
      checkUserExists("pathname");
    }
  }, [pathname, checkUserExists, status]);

  useEffect(() => {
    const handleFocus = () => {
      if (status === "authenticated" && hasPerformedInitialCheck.current) {
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
