import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send the httpOnly refresh-token cookie
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true }
    );
    const token = res.data?.data?.accessToken as string | undefined;
    if (token) {
      setAccessToken(token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const code = (error.response?.data as any)?.error?.code;

    if (status === 401 && original && !original._retry && code !== "INVALID_CREDENTIALS") {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      onUnauthorized?.();
    }

    return Promise.reject(error);
  }
);

export interface ApiErrorShape {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorShape | undefined;
    // Zod's VALIDATION_ERROR carries a generic top-level message ("Request
    // validation failed") with the actual per-field reason nested in
    // details.fieldErrors — surface that specific reason instead of the
    // generic one so a bad value (e.g. a fractional quantity) doesn't read
    // as an opaque, unexplained failure.
    if (data?.error?.code === "VALIDATION_ERROR" && data.error.details && typeof data.error.details === "object") {
      const fieldErrors = (data.error.details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      const firstField = fieldErrors && Object.values(fieldErrors).find((msgs) => msgs?.length);
      if (firstField?.[0]) return firstField[0];
    }
    if (data?.error?.message) return data.error.message;
  }
  return fallback;
}
