"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2Icon, ArrowLeftIcon, CheckCircleIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { forgotPasswordSchema, ForgotPasswordFormValues } from "@/lib/zod";

export default function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ocurrió un error al procesar la solicitud");
        return;
      }

      setUserEmail(values.email);
      setIsSubmitted(true);
    } catch {
      setError("Ocurrió un error al procesar la solicitud");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircleIcon className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Solicitud Enviada
            </CardTitle>
            <CardDescription className="text-center">
              Si existe una cuenta con el correo <strong>{userEmail}</strong>,
              recibirás un enlace para restablecer tu contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-7">
            <p className="text-sm text-gray-500 text-center">
              Revisa tu bandeja de entrada y sigue las instrucciones del correo.
              El enlace expirará en 2 horas por seguridad.
            </p>
            <Button className="w-full" asChild>
              <Link href="/login">
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                Volver a Iniciar Sesión
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Recuperar Contraseña
          </CardTitle>
          <CardDescription>
            Ingresa tu correo electrónico para recibir instrucciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
            autoComplete="off"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="text"
                placeholder="tu@correo.com"
                autoComplete="off"
                disabled={isLoading}
                {...register("email")}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Instrucciones"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                asChild
              >
                <Link href="/login">
                  <ArrowLeftIcon className="mr-2 h-4 w-4" />
                  Volver a Iniciar Sesión
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
