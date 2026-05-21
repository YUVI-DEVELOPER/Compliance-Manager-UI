import axios from "axios";
import { getStoredToken } from "../app/auth/authStorage";

const configuredBaseUrl =
  typeof import.meta.env.VITE_API_BASE_URL === "string"
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : "";

const configuredApiHost =
  typeof import.meta.env.VITE_API_HOST === "string"
    ? import.meta.env.VITE_API_HOST.trim()
    : "";

const configuredApiPort =
  typeof import.meta.env.VITE_API_PORT === "string"
    ? import.meta.env.VITE_API_PORT.trim().replace(/^:/, "")
    : "";

function getDefaultApiBaseUrl(): string {
  const apiPort = configuredApiPort || "8005";

  if (typeof window === "undefined" || !window.location.hostname) {
    return `http://${configuredApiHost || "localhost"}:${apiPort}`;
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const host = configuredApiHost || window.location.hostname;
  return `${protocol}//${host}:${apiPort}`;
}

export const apiBaseUrl = (configuredBaseUrl || getDefaultApiBaseUrl()).replace(/\/+$/, "");

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API response error:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    return Promise.reject(error);
  },
);
