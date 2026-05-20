'use client';
import React from 'react';
// In Next.js, routing protection is handled in ClientApp AppShell.
// This component is kept as a passthrough for compatibility.
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
