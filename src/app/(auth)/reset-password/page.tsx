import React, { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

const LoginPage = () => {
  return (
    <div>
      <Suspense fallback={<div>Cargando...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
};

export default LoginPage;
