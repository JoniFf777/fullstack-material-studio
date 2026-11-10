import type { FieldError } from "./types";

export const NETWORK_MESSAGE = "网络或服务暂时不可用，请稍后重试";

export type ApiErrorKind = "http" | "network";

/** 请求失败：http 表示服务端给了响应（4xx / 5xx），network 表示请求没有完成（断网、连接被拒等）。 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly fieldErrors: FieldError[];

  constructor(init: { kind: ApiErrorKind; message: string; status?: number | null; code?: string | null; fieldErrors?: FieldError[] }) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.fieldErrors = init.fieldErrors ?? [];
  }
}

/** 响应能解析，但不符合 spec/03 的约定（缺字段、类型不对、枚举值非法）。 */
export class ContractError extends Error {
  readonly path: string;

  constructor(path: string, detail: string) {
    super(`接口返回的数据不符合约定（${path}：${detail}）`);
    this.name = "ContractError";
    this.path = path;
  }
}

/** 响应头 X-User-Id 和当前登录用户不一致：另一个标签页切换了账号。 */
export class SessionChangedError extends Error {
  constructor() {
    super("登录状态已在其他页面变化，请重新加载");
    this.name = "SessionChangedError";
  }
}

export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

/** 网络错误和 5xx（包括模拟的 503 查询故障）：属于"请求异常"，可以重试，不代表业务失败。 */
export function isTransientError(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === "network" || (error.status ?? 0) >= 500);
}

export function errorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

export function errorMessage(error: unknown, fallback = NETWORK_MESSAGE): string {
  if (error instanceof ApiError || error instanceof ContractError || error instanceof SessionChangedError) return error.message;
  return fallback;
}

function looksLikeErrorBody(value: unknown): value is { code: string; message: string; fieldErrors?: unknown } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.message === "string";
}

/** 把非 2xx 响应转成 ApiError。没有按约定返回错误体时（例如代理返回的 502 页面），给通用提示。 */
export function toHttpError(status: number, body: unknown): ApiError {
  if (looksLikeErrorBody(body)) {
    const fieldErrors = Array.isArray(body.fieldErrors)
      ? body.fieldErrors.filter(
          (f): f is FieldError => typeof f === "object" && f !== null && typeof f.field === "string" && typeof f.message === "string",
        )
      : [];
    return new ApiError({ kind: "http", status, code: body.code, message: body.message, fieldErrors });
  }
  return new ApiError({
    kind: "http",
    status,
    message: status >= 500 ? NETWORK_MESSAGE : `请求失败（HTTP ${status}）`,
  });
}
