import { ApiError, NETWORK_MESSAGE, SessionChangedError, isAbortError, toHttpError } from "./errors";

interface ClientHooks {
  /** 任何请求收到 401 UNAUTHENTICATED 时调用（会话失效）。 */
  onUnauthorized?: () => void;
  /** 响应头 X-User-Id 与当前用户不一致时调用（其他标签页换了账号）。 */
  onSessionChanged?: () => void;
  /** 当前登录用户的 id；未登录时返回 null，此时不检查 X-User-Id。 */
  currentUserId?: () => number | null;
}

let hooks: ClientHooks = {};

/** 由 AuthProvider 注册；返回的函数用于卸载时注销。 */
export function configureApiClient(next: ClientHooks): () => void {
  hooks = next;
  return () => {
    if (hooks === next) hooks = {};
  };
}

export function notifyUnauthorized(): void {
  hooks.onUnauthorized?.();
}

export interface RequestOptions {
  method?: string;
  json?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** 账号接口（me / login / register / logout）不检查 X-User-Id。 */
  checkUser?: boolean;
}

export interface ApiResponse<T> {
  status: number;
  headers: Headers;
  data: T;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  let body: string | undefined;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: options.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    // 取消原样抛出，TanStack Query 会把它当作取消而不是错误
    if (isAbortError(error) || options.signal?.aborted) throw error;
    throw new ApiError({ kind: "network", message: NETWORK_MESSAGE });
  }

  const payload = await readJson(res);
  if (!res.ok) {
    const error = toHttpError(res.status, payload);
    if (res.status === 401 && error.code === "UNAUTHENTICATED") hooks.onUnauthorized?.();
    throw error;
  }

  if (options.checkUser !== false) {
    const expected = hooks.currentUserId?.() ?? null;
    const actual = res.headers.get("x-user-id");
    if (expected !== null && actual !== null && actual !== String(expected)) {
      hooks.onSessionChanged?.();
      throw new SessionChangedError();
    }
  }

  return { status: res.status, headers: res.headers, data: payload as T };
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequest<T>(path, options)).data;
}
