import React from "react";

import { useAuth } from "./useAuth";

interface PermissionGuardProps {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  const allowed = permission
    ? hasPermission(permission)
    : anyOf
      ? hasAnyPermission(anyOf)
      : allOf
        ? hasAllPermissions(allOf)
        : true;

  return allowed ? <>{children}</> : <>{fallback}</>;
}
