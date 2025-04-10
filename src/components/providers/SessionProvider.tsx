"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={30 * 60} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
