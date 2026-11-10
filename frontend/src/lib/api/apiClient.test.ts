import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeApi, delayed, json, networkError, type FakeApi } from "@/test/fakeApi";
import { fixture, taskFixture } from "@/test/fixtures";
import { apiFetch, configureApiClient } from "./client";
import { getMe, getTask, submitTask } from "./endpoints";
import { ApiError, ContractError, NETWORK_MESSAGE, SessionChangedError, isTransientError } from "./errors";

describe("apiClient", () => {
  let api: FakeApi;
  let unregister: (() => void) | undefined;

  beforeEach(() => {
    api = createFakeApi();
    api.install();
  });

  afterEach(() => {
    unregister?.();
    unregister = undefined;
  });

  it("2xx 正常解析 JSON；204 返回 undefined", async () => {
    api.on("GET", "/api/categories", json(200, fixture("categories")));
    api.on("POST", "/api/auth/logout", json(204));
    await expect(apiFetch("/api/categories")).resolves.toEqual(fixture("categories"));
    await expect(apiFetch("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("4xx 解析成带 code、message、fieldErrors 的 ApiError(http)", async () => {
    api.on("POST", "/api/auth/register", json(400, fixture("error-validation")));
    const error = await apiFetch("/api/auth/register", { method: "POST", json: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "http", status: 400, code: "VALIDATION_FAILED" });
    expect((error as ApiError).fieldErrors.map((f) => f.field)).toEqual(["username", "password"]);
    expect(isTransientError(error)).toBe(false);
  });

  it("5xx 没有按约定返回错误体时给通用提示，并算作可重试的请求异常", async () => {
    api.on("GET", "/api/tasks", json(502, undefined));
    const error = await apiFetch("/api/tasks").catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "http", status: 502, code: null, message: NETWORK_MESSAGE });
    expect(isTransientError(error)).toBe(true);
  });

  it("模拟的查询故障 503 SERVICE_UNAVAILABLE 也算请求异常", async () => {
    api.on("GET", "/api/tasks/101", json(503, { code: "SERVICE_UNAVAILABLE", message: "状态查询暂时不可用", fieldErrors: [] }));
    const error = await getTask(101).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" });
    expect(isTransientError(error)).toBe(true);
  });

  it("fetch 本身抛错时变成 ApiError(network)", async () => {
    api.on("GET", "/api/tasks", networkError());
    const error = await apiFetch("/api/tasks").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "network", status: null, message: NETWORK_MESSAGE });
    expect(isTransientError(error)).toBe(true);
  });

  it("AbortError 原样抛出，不包装成 ApiError", async () => {
    api.on("GET", "/api/tasks/101", delayed(5_000, json(200, taskFixture("processing"))));
    const controller = new AbortController();
    const pending = apiFetch("/api/tasks/101", { signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();
    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: "AbortError" });
  });

  it("401 UNAUTHENTICATED 时调用 onUnauthorized；登录失败的 401 不调用", async () => {
    const onUnauthorized = vi.fn();
    unregister = configureApiClient({ onUnauthorized });
    api.on("GET", "/api/tasks", json(401, { code: "UNAUTHENTICATED", message: "请先登录", fieldErrors: [] }));
    api.on("POST", "/api/auth/login", json(401, { code: "INVALID_CREDENTIALS", message: "用户名或密码错误", fieldErrors: [] }));

    await expect(apiFetch("/api/tasks")).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(apiFetch("/api/auth/login", { method: "POST", json: {} })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("X-User-Id 与当前用户不一致时抛 SessionChangedError；账号接口不检查（P1）", async () => {
    const onSessionChanged = vi.fn();
    unregister = configureApiClient({ currentUserId: () => 1, onSessionChanged });
    api.on("GET", "/api/tasks/101", json(200, taskFixture("processing"), { "X-User-Id": "2" }));
    api.on("GET", "/api/auth/me", json(200, { user: { ...fixture<{ user: object }>("user").user, id: 2 } }, { "X-User-Id": "2" }));

    await expect(getTask(101)).rejects.toBeInstanceOf(SessionChangedError);
    expect(onSessionChanged).toHaveBeenCalledTimes(1);
    await expect(getMe()).resolves.toMatchObject({ id: 2 });
  });

  it("响应不符合契约时抛 ContractError，指出字段", async () => {
    api.on("GET", "/api/tasks/101", json(200, { ...taskFixture("processing"), status: "DONE" }));
    const error = await getTask(101).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContractError);
    expect((error as ContractError).path).toBe("$.status");
  });

  it("提交任务时带上 Idempotency-Key 请求头", async () => {
    api.on("POST", "/api/tasks", json(202, taskFixture("pending"), { Location: "/api/tasks/101" }));
    await expect(submitTask("travel-postcard", [11, 12], "key-123")).resolves.toMatchObject({ id: 101, status: "PENDING" });
    expect(api.headers("POST", "/api/tasks")[0].get("Idempotency-Key")).toBe("key-123");
    expect(JSON.parse(String(api.requests("POST", "/api/tasks")[0].body))).toEqual({ templateId: "travel-postcard", materialIds: [11, 12] });
  });
});
