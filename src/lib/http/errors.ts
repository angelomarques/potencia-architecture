import { isAxiosError } from "axios";

/** Normalised error thrown by every Potencia HTTP client. */
export class HttpError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly method: string | null;
  readonly url: string | null;
  readonly data: unknown;
  readonly isTimeout: boolean;
  readonly isNetworkError: boolean;

  constructor(init: {
    message: string;
    status?: number | null;
    code?: string | null;
    method?: string | null;
    url?: string | null;
    data?: unknown;
    isTimeout?: boolean;
    isNetworkError?: boolean;
    cause?: unknown;
  }) {
    super(init.message, { cause: init.cause });
    this.name = "HttpError";
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.method = init.method ?? null;
    this.url = init.url ?? null;
    this.data = init.data;
    this.isTimeout = init.isTimeout ?? false;
    this.isNetworkError = init.isNetworkError ?? false;
  }
}

/** Convert anything thrown by axios into an HttpError (secrets/headers are never copied). */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const method = error.config?.method?.toUpperCase() ?? null;
    const url = error.config?.url ?? null;
    const isTimeout =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
    return new HttpError({
      message: status
        ? `HTTP ${status} ${method ?? ""} ${url ?? ""}`.trim()
        : `${isTimeout ? "Timeout" : "Network error"}: ${method ?? ""} ${url ?? ""} (${error.message})`,
      status,
      code: error.code ?? null,
      method,
      url,
      data: error.response?.data,
      isTimeout,
      isNetworkError: !error.response,
      cause: error,
    });
  }
  return new HttpError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
}
