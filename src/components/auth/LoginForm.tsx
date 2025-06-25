"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { loginAction } from "@/actions/auth";
import { Loader2Icon, EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

import { loginSchema, LoginFormValues } from "@/lib/zod";

function LoginFormContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setIsLoading(true);

      sessionStorage.setItem("lastLoginTime", Date.now().toString());
      sessionStorage.setItem("loginAttempt", "true");

      const result = await loginAction(values);

      if (result.error) {
        sessionStorage.removeItem("lastLoginTime");
        sessionStorage.removeItem("loginAttempt");

        if (
          typeof result.error === "string" &&
          result.error.includes("INVALID_CREDENTIALS")
        ) {
          toast.error("Credenciales no válidas", {
            duration: 4000,
          });
        } else {
          toast.error("Error", {
            description:
              typeof result.error === "string"
                ? result.error
                : "Ocurrió un error durante el inicio de sesión",
            duration: 4000,
          });
        }

        setIsLoading(false);
        return;
      }

      toast.success("Sesión iniciada correctamente", {
        duration: 2000,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      if (process.env.NODE_ENV === "production") {
        window.location.href = callbackUrl.startsWith("/")
          ? `https://telasytejidosluciana.com${callbackUrl}`
          : callbackUrl;
      } else {
        window.location.href = callbackUrl;
      }
    } catch (error) {
      sessionStorage.removeItem("lastLoginTime");
      sessionStorage.removeItem("loginAttempt");

      toast.error("Error de conexión", {
        duration: 4000,
      });
      console.error(error);

      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] sm:min-h-screen flex-col items-center justify-center bg-gray-100 p-4 sm:p-8">
      <div className="mb-4 sm:mb-8 flex flex-col items-center">
        <Image
          src="/images/logo.svg"
          alt="Logo de la empresa"
          width={180}
          height={60}
          priority
          className="mb-4"
        />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                disabled={isLoading}
                {...register("email")}
                className={errors.email ? "border-red-500" : ""}
                aria-invalid={errors.email ? "true" : "false"}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  {...register("password")}
                  className={errors.password ? "border-red-500" : ""}
                  aria-invalid={errors.password ? "true" : "false"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-500">
            Sistema de administración. Solo usuarios autorizados.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="flex min-h-[100dvh] sm:min-h-screen flex-col items-center justify-center bg-gray-100 p-4 sm:p-8">
      <div className="mb-4 sm:mb-8 flex flex-col items-center">
        <Image
          src="/images/logo.svg"
          alt="Logo de la empresa"
          width={180}
          height={60}
          priority
          className="mb-4"
        />
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2Icon className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormContent />
    </Suspense>
  );
}
