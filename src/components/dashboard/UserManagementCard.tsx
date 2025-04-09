import React, { useState, useRef } from "react";
import { toast } from "sonner";

import {
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  UsersIcon,
  CheckIcon,
  XIcon,
  Loader2Icon,
  TrashIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { User } from "../../../types/types";

interface UserManagementCardProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  isLoadingUsers: boolean;
  setOpenNewUser: React.Dispatch<React.SetStateAction<boolean>>;
}

export const UserManagementCard: React.FC<UserManagementCardProps> = ({
  users,
  setUsers,
  isLoadingUsers,
  setOpenNewUser,
}) => {
  const [userManagementCollapsed, setUserManagementCollapsed] = useState(false);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const pendingActions = useRef<Record<string, boolean>>({});

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    if (pendingActions.current[userToDelete.id]) return;

    pendingActions.current[userToDelete.id] = true;

    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar el usuario");
      }

      toast.success(`Usuario eliminado correctamente`);

      setUsers(users.filter((user) => user.id !== userToDelete.id));

      setConfirmDeleteOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar el usuario");
    } finally {
      if (userToDelete) {
        setTimeout(() => {
          pendingActions.current[userToDelete.id] = false;
        }, 300);
      }
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center mb-1">
            <UsersIcon className="mr-2 h-5 w-5" />
            Gestión de Usuarios
          </CardTitle>
          <CardDescription>
            {users.length} usuarios en el sistema
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="bg-black hover:bg-gray-800 rounded-full"
                  onClick={() => setOpenNewUser(true)}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Añadir Nuevo Usuario</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setUserManagementCollapsed(!userManagementCollapsed)
                  }
                >
                  {userManagementCollapsed ? (
                    <ChevronDownIcon className="h-5 w-5" />
                  ) : (
                    <ChevronUpIcon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{userManagementCollapsed ? "Expandir" : "Colapsar"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!userManagementCollapsed && (
        <CardContent>
          {userSuccess && (
            <Alert className="bg-green-50 border-green-500 mb-4">
              <CheckIcon className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                {userSuccess}
              </AlertDescription>
            </Alert>
          )}

          {isLoadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2Icon className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo Electrónico</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Último Acceso</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-gray-500"
                    >
                      No hay usuarios registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "outline"
                          }
                        >
                          {user.role === "admin" ? "Administrador" : "Vendedor"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Nunca"}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-800"
                                onClick={() => handleDeleteUser(user)}
                                disabled={pendingActions.current[user.id]}
                              >
                                <TrashIcon className="mr-1 h-3 w-3" />
                                Eliminar
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Eliminar usuario</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Diálogo de confirmación para eliminar usuario */}
          <AlertDialog
            open={confirmDeleteOpen}
            onOpenChange={setConfirmDeleteOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente
                  el usuario <strong>{userToDelete?.name}</strong> y toda su
                  información asociada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      )}
    </Card>
  );
};
