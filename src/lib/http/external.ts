import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";
import { toHttpError } from "./errors";
import { attachRetry, type RetryOptions } from "./retry";

/**
 * Factory for clients that talk to third-party APIs (Cloudflare, Turnstile, Resend, ...).
 * - 10s default timeout
 * - retries idempotent requests (GET/HEAD/OPTIONS/PUT/DELETE) on network errors, 408/425/429/5xx
 * - every failure is rethrown as `HttpError`
 */
export function createExternalClient(
  config: CreateAxiosDefaults = {},
  retry: RetryOptions = { retries: 2, baseDelayMs: 250 },
): AxiosInstance {
  const instance = axios.create({ timeout: 10_000, ...config });
  attachRetry(instance, retry);
  instance.interceptors.response.use(undefined, (error) => {
    throw toHttpError(error);
  });
  return instance;
}

/** Default external client. Pass absolute URLs. */
export const http = createExternalClient();
