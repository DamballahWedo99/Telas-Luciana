import React from "react";

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-black"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          Cargando sistema
        </h2>
        <p className="text-gray-500">Verificando credenciales y permisos...</p>
      </div>
    </div>
  );
};
