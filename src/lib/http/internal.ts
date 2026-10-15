import axios from "axios";
import { env } from "@/env";
import { toHttpError } from "./errors";
import { attachRetry } from "./retry";

function resolveBaseURL(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return env.NEXT_PUBLIC_APP_URL;
}

/**
 * Client for this app's own API routes (`/api/*`).
 * Relative paths resolve against the browser origin, or NEXT_PUBLIC_APP_URL on the server.
 * Sends cookies (`withCredentials`) so better-auth sessions flow through.
 */
export const api = axios.create({
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  config.baseURL ??= resolveBaseURL();
  return config;
});
attachRetry(api, { retries: 1, baseDelayMs: 200 });
api.interceptors.response.use(undefined, (error) => {
  throw toHttpError(error);
});
