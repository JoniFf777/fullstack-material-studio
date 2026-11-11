import { onlineManager } from "@tanstack/react-query";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/lib/api/types";
import { createFakeApi, delayed, json, networkError, type FakeApi } from "@/test/fakeApi";
import { taskFixture } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { HistoryPanel } from "./HistoryPanel";

// spec/06 §5.4 taskTracking：多任务不串扰、终态即停、查询异常不等于失败、卸载清理、刷新恢复、浏览器离线

const LIST = "/api/tasks?templateId=travel-postcard&limit=50";
const POLL = 1500;

function travel(kind: "pending" | "processing" | "succeeded" | "failed", id: number, patch: Partial<TaskDto> = {}): TaskDto {
  return taskFixture(kind, {
    id,
    templateId: "travel-postcard",
    templateTitle: "旅行明信片",
    coverUrl: "/demo/covers/travel-postcard.png",
    resultUrl: kind === "succeeded" ? `/api/tasks/${id}/result` : null,
    ...patch,
  });
}

const outage = json(503, { code: "SERVICE_UNAVAILABLE", message: "状态查询暂时不可用，任务仍在后台处理", fieldErrors: [] });

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const card = (id: number) => screen.getByRole("article", { name: `任务 #${id}` });
const statusOf = (id: number) => within(card(id)).getByRole("status");

describe("任务跟踪（HistoryPanel + TaskCard）", () => {
  let api: FakeApi;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api = createFakeApi();
    api.install();
  });

  afterEach(() => {
    // onlineManager 是全局单例，不能把"离线"状态留给后面的测试
    onlineManager.setOnline(true);
  });

  it("① 多任务不串扰：A 显示 A 的结果图，B 显示 B 的失败原因", async () => {
    const a = travel("processing", 201);
    const b = travel("processing", 202);
    api.on("GET", LIST, json(200, { items: [b, a] }));
    api.on("GET", "/api/tasks/201", [json(200, a), json(200, travel("succeeded", 201))]);
    api.on("GET", "/api/tasks/202", [json(200, b), json(200, travel("failed", 202, { errorMessage: "B 的失败原因" }))]);

    renderWithProviders(<HistoryPanel templateId="travel-postcard" />);
    await screen.findByRole("article", { name: "任务 #201" });
    await advance(POLL + 100);
    await advance(POLL + 100);

    expect(statusOf(201)).toHaveTextContent("已完成");
    expect(within(card(201)).getByRole("img", { name: "旅行明信片的制作结果" })).toHaveAttribute("src", "/api/tasks/201/result");
    expect(within(card(201)).queryByText("B 的失败原因")).toBeNull();

    expect(statusOf(202)).toHaveTextContent("失败 · 模拟生成");
    expect(within(card(202)).getByText("B 的失败原因")).toBeInTheDocument();
    expect(within(card(202)).queryByRole("img", { name: /制作结果/ })).toBeNull();
  });

  it("② 终态即停：任务结束后不再请求它；全部结束后没有任何请求，列表也不轮询", async () => {
    const a = travel("processing", 201);
    const b = travel("processing", 202);
    api.on("GET", LIST, json(200, { items: [b, a] }));
    api.on("GET", "/api/tasks/201", json(200, travel("succeeded", 201)));
    api.on("GET", "/api/tasks/202", [json(200, b), json(200, b), json(200, travel("failed", 202))]);

    renderWithProviders(<HistoryPanel templateId="travel-postcard" />);
    await screen.findByRole("article", { name: "任务 #201" });
    await advance(100);
    expect(statusOf(201)).toHaveTextContent("已完成");

    const aCalls = api.calls("GET", "/api/tasks/201");
    await advance(POLL * 3);
    expect(api.calls("GET", "/api/tasks/201")).toBe(aCalls);
    expect(statusOf(202)).toHaveTextContent("失败 · 模拟生成");

    const total = api.totalCalls();
    await advance(POLL * 5);
    expect(api.totalCalls()).toBe(total);
    expect(api.calls("GET", LIST)).toBe(1);
  });

  it("③ 查询异常不等于失败：B 显示提示和「重新查询」，主文案仍是处理中；A 照常推进；重新查询后恢复轮询", async () => {
    const a = travel("processing", 201);
    const b = travel("processing", 202);
    api.on("GET", LIST, json(200, { items: [b, a] }));
    api.on("GET", "/api/tasks/201", [json(200, a), json(200, a), json(200, a), json(200, travel("succeeded", 201))]);
    api.on("GET", "/api/tasks/202", [outage, json(200, b), json(200, travel("succeeded", 202))]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<HistoryPanel templateId="travel-postcard" />);
    await screen.findByRole("article", { name: "任务 #202" });
    await advance(100);

    expect(statusOf(202)).toHaveTextContent("处理中 · 模拟生成");
    expect(statusOf(202).textContent).not.toContain("失败");
    expect(within(card(202)).getByRole("alert")).toHaveTextContent("状态更新失败，任务仍在后台处理");
    expect(within(card(202)).queryByText(/^失败/)).toBeNull();

    // B 暂停轮询，A 照常推进
    const bCalls = api.calls("GET", "/api/tasks/202");
    await advance(POLL * 2);
    expect(api.calls("GET", "/api/tasks/202")).toBe(bCalls);
    expect(api.calls("GET", "/api/tasks/201")).toBeGreaterThan(1);

    await user.click(within(card(202)).getByRole("button", { name: "重新查询任务 #202" }));
    await advance(100);
    expect(within(card(202)).queryByRole("alert")).toBeNull();
    expect(statusOf(202)).toHaveTextContent("处理中 · 模拟生成");

    await advance(POLL + 100);
    expect(statusOf(202)).toHaveTextContent("已完成");
  });

  it("④ 卸载清理：卸载后不再请求，进行中的请求收到 abort", async () => {
    const a = travel("processing", 201);
    api.on("GET", LIST, json(200, { items: [a] }));
    api.on("GET", "/api/tasks/201", [json(200, a), delayed(1000, json(200, a))]);

    const { unmount } = renderWithProviders(<HistoryPanel templateId="travel-postcard" />);
    await screen.findByRole("article", { name: "任务 #201" });
    await advance(POLL + 100);
    expect(api.calls("GET", "/api/tasks/201")).toBe(2);
    const inflight = api.signals("GET", "/api/tasks/201")[1];
    expect(inflight?.aborted).toBe(false);

    unmount();
    expect(inflight?.aborted).toBe(true);
    const total = api.totalCalls();
    await advance(POLL * 4);
    expect(api.totalCalls()).toBe(total);
  });

  it("⑤ 刷新恢复：用列表数据渲染，只有未完成的任务发起轮询，并最终更新到终态", async () => {
    const running = travel("processing", 301);
    const done = travel("succeeded", 302);
    api.on("GET", LIST, json(200, { items: [done, running] }));
    api.on("GET", "/api/tasks/301", [json(200, running), json(200, travel("succeeded", 301))]);
    api.on("GET", "/api/tasks/302", json(200, done));

    renderWithProviders(<HistoryPanel templateId="travel-postcard" />);
    await screen.findByRole("article", { name: "任务 #301" });
    await advance(POLL + 200);

    expect(statusOf(301)).toHaveTextContent("已完成");
    expect(statusOf(302)).toHaveTextContent("已完成");
    expect(api.calls("GET", "/api/tasks/302")).toBe(0);
  });

  it("⑥ 浏览器离线（开发者工具切到 Offline）：同样显示提示和「重新查询」，不会悄悄停在处理中；联网后自动刷新", async () => {
    const a = travel("processing", 201);
    api.on("GET", LIST, json(200, { items: [a] }));
    api.on("GET", "/api/tasks/201", [json(200, a), networkError(), json(200, travel("succeeded", 201))]);

    renderWithProviders(<HistoryPanel templateId="travel-postcard" />);
    await screen.findByRole("article", { name: "任务 #201" });
    await advance(100);
    expect(statusOf(201)).toHaveTextContent("处理中 · 模拟生成");

    // 浏览器报告离线后，下一次轮询的请求失败，卡片显示查询异常的提示，主文案仍是处理中
    act(() => onlineManager.setOnline(false));
    await advance(POLL + 100);
    expect(within(card(201)).getByRole("alert")).toHaveTextContent("状态更新失败，任务仍在后台处理");
    expect(statusOf(201)).toHaveTextContent("处理中 · 模拟生成");

    // 联网后自动重新查询，不需要用户操作
    act(() => onlineManager.setOnline(true));
    await advance(100);
    expect(within(card(201)).queryByRole("alert")).toBeNull();
    expect(statusOf(201)).toHaveTextContent("已完成");
  });
});
