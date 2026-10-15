import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

const IDEMPOTENT = new Set(["get", "head", "options", "put", "delete"]);
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export type RetryOptions = { retries: number; baseDelayMs: number };

type RetryConfig = InternalAxiosRequestConfig & {
  /** Per-request override: number of retries, or false to disable. */
  retry?: number | false;
  __retryCount?: number;
};

declare module "axios" {
  interface AxiosRequestConfig {
    /** Retries for this request (idempotent methods only unless set explicitly). `false` disables. */
    retry?: number | false;
  }
}

function shouldRetry(error: AxiosError, config: RetryConfig, max: number): boolean {
  if ((config.__retryCount ?? 0) >= max) return false;
  const method = (config.method ?? "get").toLowerCase();
  // Non-idempotent methods only retry when the caller opts in explicitly.
  if (!IDEMPOTENT.has(method) && typeof config.retry !== "number") return false;
  if (!error.response) return error.code !== "ERR_CANCELED";
  return RETRY_STATUS.has(error.response.status);
}

/** Small exponential-backoff retry interceptor (no axios-retry dependency). */
export function attachRetry(instance: AxiosInstance, opts: RetryOptions): void {
  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (!config || config.retry === false) throw error;
    const max = typeof config.retry === "number" ? config.retry : opts.retries;
    if (!shouldRetry(error, config, max)) throw error;
    config.__retryCount = (config.__retryCount ?? 0) + 1;
    const retryAfter = Number(error.response?.headers?.["retry-after"]);
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 10_000)
      : opts.baseDelayMs * 2 ** (config.__retryCount - 1) + Math.random() * 100;
    await new Promise((r) => setTimeout(r, delay));
    return instance.request(config);
  });
}
