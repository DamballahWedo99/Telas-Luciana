import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Session } from "next-auth";
import { toast } from "sonner";

import { EyeIcon, EyeOffIcon, UserPlusIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { createUserAction } from "@/actions/auth";
import { User } from "../../../types/types";
import { createUserSchema, CreateUserFormValues } from "@/lib/zod";

interface NewUserDialogProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  session: Session | null;
}

export const NewUserDialog: React.FC<NewUserDialogProps> = ({
  open,
  setOpen,
  users,
  setUsers,
  session,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "seller",
    },
  });

  const onUserSubmit = async (values: CreateUserFormValues) => {
    if (isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setIsCreatingUser(true);
      setUserError(null);

      if (!session?.user?.id) {
        setUserError("No hay sesión activa");
        return;
      }

      const result = await createUserAction(values, session.user.id);

      if (result.error) {
        setUserError(result.error);
        return;
      }

      if (result.success && result.user) {
        const newUser: User = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role as "major_admin" | "admin" | "seller",
          createdAt: new Date().toISOString(),
        };

        setUsers([newUser, ...users]);
        reset();
        setOpen(false);

        toast.success(`Usuario creado exitosamente`);
      }
    } catch (error) {
      setUserError("Ocurrió un error al crear el usuario");
      console.error(error);
    } finally {
      setIsCreatingUser(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  };

  React.useEffect(() => {
    if (!open) {
      isSubmittingRef.current = false;
    }
  }, [open]);

  const handleRoleChange = (value: string) => {
    if (value === "major_admin" || value === "admin" || value === "seller") {
      setValue("role", value);
    }
  };

  const generatePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specialChars = "!@#$%^&*()_+-=.";

    let password = "";

    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));

    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));

    password += numbers.charAt(Math.floor(Math.random() * numbers.length));

    const safeChars = uppercase + lowercase + numbers + specialChars;

    const remainingLength = 5;
    for (let i = 0; i < remainingLength; i++) {
      const randomIndex = Math.floor(Math.random() * safeChars.length);
      password += safeChars[randomIndex];
    }

    password = password
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");

    setValue("password", password, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });

    setShowPassword(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Complete el formulario para crear un nuevo usuario en el sistema.
          </DialogDescription>
        </DialogHeader>

        {userError && (
          <Alert variant="destructive">
            <AlertDescription>{userError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onUserSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre Completo</Label>
            <Input
              id="name"
              placeholder="Juan Pérez"
              disabled={isCreatingUser}
              {...register("name")}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="juan@ejemplo.com"
              disabled={isCreatingUser}
              {...register("email")}
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  disabled={isCreatingUser}
                  {...register("password")}
                  className={errors.password ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={generatePassword}
              >
                Generar
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select onValueChange={handleRoleChange} defaultValue="seller">
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="major_admin">
                  Administrador Principal
                </SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="seller">Vendedor</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-500">{errors.role.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isCreatingUser}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreatingUser || isSubmittingRef.current}
            >
              {isCreatingUser ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlusIcon className="mr-2 h-4 w-4" />
                  Crear Usuario
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
