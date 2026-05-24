import type { StoredAuthUser } from "./authStorage";
import { useAuth } from "./useAuth";

export interface CurrentActor {
  user: StoredAuthUser | null;
  id: string | null;
  email: string | null;
  fullName: string | null;
  displayName: string;
  auditName: string | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
}

export function useCurrentActor(): CurrentActor {
  const { isAuthenticated, permissions, roles, user } = useAuth();
  const fullName = user?.full_name?.trim() || null;
  const email = user?.email?.trim() || null;
  const id = user?.id?.trim() || null;
  const displayName = fullName || email || "Authenticated user";

  return {
    user,
    id,
    email,
    fullName,
    displayName,
    auditName: email || fullName || id,
    roles,
    permissions,
    isAuthenticated,
  };
}

