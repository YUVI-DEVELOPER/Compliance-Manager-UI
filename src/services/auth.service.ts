import { api } from "./api";
import { StoredAuthUser } from "../app/auth/authStorage";

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: StoredAuthUser;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export async function loginWithPassword(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/login", { email, password });
  return response.data;
}

export async function getCurrentUser(): Promise<StoredAuthUser> {
  const response = await api.get<StoredAuthUser>("/auth/me");
  return response.data;
}

export async function logoutSession(): Promise<void> {
  await api.post("/auth/logout");
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await api.post("/auth/change-password", payload);
}
