/**
 * API client for the Laravel backend.
 *
 * The backend authenticates this SPA with Sanctum's stateful (cookie) mode, so
 * every request must carry cookies and every write must carry the CSRF token.
 * Those rules live here rather than at each call site.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Any non-2xx response. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 422 — field-level validation failures from a FormRequest. */
export class ApiValidationError extends ApiError {
  constructor(
    message: string,
    readonly errors: Record<string, string[]>,
  ) {
    super(message, 422);
    this.name = "ApiValidationError";
  }

  /** First message for a field, if any. */
  first(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

/** 401 — no (or no longer a) valid session. */
export class UnauthenticatedError extends ApiError {
  constructor(message = "Unauthenticated.") {
    super(message, 401);
    this.name = "UnauthenticatedError";
  }
}

/** 429 — a rate limit was hit; `retryAfter` is the wait in seconds. */
export class RateLimitedError extends ApiError {
  constructor(
    message: string,
    readonly retryAfter: number | null,
  ) {
    super(message, 429);
    this.name = "RateLimitedError";
  }
}

type UnauthenticatedHandler = () => void;
let onUnauthenticated: UnauthenticatedHandler | null = null;

/**
 * Register what should happen when the server stops accepting our session.
 *
 * Every request goes through this module, so catching 401 here is the only
 * place that covers all of them — a session can expire during any call, not
 * just the ones a screen thought to handle.
 */
export function setUnauthenticatedHandler(
  handler: UnauthenticatedHandler | null,
): void {
  onUnauthenticated = handler;
}

function readCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  // Cookie values are URL-encoded; the token is rejected if sent raw.
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

let csrfReady = false;

/**
 * Fetch the XSRF-TOKEN cookie once per page load. Sanctum sets it on this
 * endpoint; subsequent writes echo it back in the X-XSRF-TOKEN header.
 */
async function ensureCsrfCookie(): Promise<void> {
  if (csrfReady) return;
  await fetch(`${BASE_URL}/sanctum/csrf-cookie`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  csrfReady = true;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  if (method !== "GET") {
    await ensureCsrfCookie();
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const token = readCookie("XSRF-TOKEN");
  if (token && method !== "GET") {
    headers["X-XSRF-TOKEN"] = token;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    // Required for the session cookie to travel cross-origin (5173 → 8000).
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message ?? `Request failed (${response.status}).`;
    if (response.status === 401) {
      // Tell the app before throwing, so the session is torn down even if the
      // caller only logs the error.
      onUnauthenticated?.();
      throw new UnauthenticatedError(message);
    }
    if (response.status === 422) {
      throw new ApiValidationError(message, payload?.errors ?? {});
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      throw new RateLimitedError(
        message,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      );
    }
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
