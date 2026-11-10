// 假 API（spec/06 §5.2）：按顺序返回脚本化的响应，序列用完后一直返回最后一个；
// 记录每次调用的次数、AbortSignal 和请求头，用来断言"有没有继续请求""请求有没有被取消"。
import { vi } from "vitest";

export type Scripted =
  | { kind: "json"; status: number; body: unknown; headers?: Record<string, string> }
  | { kind: "network" }
  | { kind: "delayed"; ms: number; inner: Scripted };

export const json = (status: number, body?: unknown, headers?: Record<string, string>): Scripted => ({ kind: "json", status, body, headers });
export const networkError = (): Scripted => ({ kind: "network" });
export const delayed = (ms: number, inner: Scripted): Scripted => ({ kind: "delayed", ms, inner });

export interface RecordedCall {
  method: string;
  path: string;
  signal: AbortSignal | undefined;
  headers: Headers;
  body: unknown;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

async function respond(scripted: Scripted, signal: AbortSignal | undefined): Promise<Response> {
  if (signal?.aborted) throw abortError();
  switch (scripted.kind) {
    case "network":
      throw new TypeError("Failed to fetch");
    case "delayed":
      await sleep(scripted.ms, signal);
      return respond(scripted.inner, signal);
    case "json": {
      const body = scripted.body === undefined || scripted.status === 204 ? null : JSON.stringify(scripted.body);
      return new Response(body, { status: scripted.status, headers: { "Content-Type": "application/json", ...scripted.headers } });
    }
  }
}

export function createFakeApi() {
  const routes = new Map<string, { responses: Scripted[]; next: number }>();
  const log: RecordedCall[] = [];
  const key = (method: string, path: string) => `${method.toUpperCase()} ${path}`;
  const matching = (method: string, path: string) => log.filter((c) => key(c.method, c.path) === key(method, path));

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "http://localhost");
    const path = url.pathname + url.search;
    const method = (init?.method ?? "GET").toUpperCase();
    log.push({ method, path, signal: init?.signal ?? undefined, headers: new Headers(init?.headers), body: init?.body });
    const route = routes.get(key(method, path));
    if (!route) throw new Error(`fakeApi：没有为 ${method} ${path} 准备响应`);
    const scripted = route.responses[Math.min(route.next, route.responses.length - 1)];
    route.next += 1;
    return respond(scripted, init?.signal ?? undefined);
  };

  return {
    fetch,
    on(method: string, path: string, responses: Scripted | Scripted[]) {
      routes.set(key(method, path), { responses: Array.isArray(responses) ? responses : [responses], next: 0 });
    },
    calls: (method: string, path: string) => matching(method, path).length,
    requests: (method: string, path: string) => matching(method, path),
    signals: (method: string, path: string) => matching(method, path).map((c) => c.signal),
    headers: (method: string, path: string) => matching(method, path).map((c) => c.headers),
    totalCalls: () => log.length,
    install() {
      vi.stubGlobal("fetch", fetch);
    },
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;

/** 上传用的最小假 XHR：测试里手动推进进度、返回结果或制造失败。 */
export class FakeXhr {
  static instances: FakeXhr[] = [];

  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  responseType = "";
  status = 0;
  responseText = "";
  method = "";
  url = "";
  body: unknown = null;
  aborted = false;
  requestHeaders: Record<string, string> = {};
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  send(body: unknown) {
    this.body = body;
    FakeXhr.instances.push(this);
  }

  abort() {
    if (this.aborted) return;
    this.aborted = true;
    this.onabort?.();
  }

  // ── 测试控制 ──
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = body === undefined ? "" : JSON.stringify(body);
    this.onload?.();
  }

  failNetwork() {
    this.onerror?.();
  }

  static install() {
    FakeXhr.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  }

  static last(): FakeXhr {
    const xhr = FakeXhr.instances.at(-1);
    if (!xhr) throw new Error("FakeXhr：还没有发出任何上传请求");
    return xhr;
  }
}
