import React from "react";

import { AccessDeniedPage } from "./AccessDeniedPage";
import { useAuth } from "./useAuth";

interface ProtectedPageProps {
  anyOf?: string[];
  allOf?: string[];
  children: React.ReactNode;
}

export function ProtectedPage({ anyOf, allOf, children }: ProtectedPageProps) {
  const { hasAnyPermission, hasAllPermissions } = useAuth();

  if (anyOf && anyOf.length > 0 && !hasAnyPermission(anyOf)) {
    return <AccessDeniedPage />;
  }

  if (allOf && allOf.length > 0 && !hasAllPermissions(allOf)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
}
