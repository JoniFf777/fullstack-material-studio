import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { taskFixture } from "@/test/fixtures";
import { deriveTaskView, QUERY_PROBLEM_TEXT } from "./taskView";

const outage = new ApiError({ kind: "http", status: 503, code: "SERVICE_UNAVAILABLE", message: "状态查询暂时不可用" });
const offline = new ApiError({ kind: "network", message: "网络或服务暂时不可用，请稍后重试" });
const notFound = new ApiError({ kind: "http", status: 404, code: "TASK_NOT_FOUND", message: "任务不存在" });

const states = (view: ReturnType<typeof deriveTaskView>) => view.steps.map((s) => s.state);

describe("deriveTaskView", () => {
  it("PENDING：等待处理、排队中，三步都没开始", () => {
    const view = deriveTaskView(taskFixture("pending"));
    expect(view.label).toBe("等待处理");
    expect(view.hint).toBe("排队中");
    expect(states(view)).toEqual(["todo", "todo", "todo"]);
    expect(view.queryProblem).toBeNull();
  });

  it("PROCESSING：处理中 · 当前阶段，当前段进行中", () => {
    const view = deriveTaskView(taskFixture("processing"));
    expect(view.label).toBe("处理中 · 模拟生成");
    expect(view.tone).toBe("processing");
    expect(states(view)).toEqual(["done", "active", "todo"]);
  });

  it("PROCESSING 但还没进入任何阶段：只显示处理中", () => {
    const view = deriveTaskView(taskFixture("processing", { stage: null, steps: [] }));
    expect(view.label).toBe("处理中");
    expect(states(view)).toEqual(["todo", "todo", "todo"]);
  });

  it("SUCCEEDED：已完成，带结果图，三步都完成", () => {
    const view = deriveTaskView(taskFixture("succeeded"));
    expect(view.label).toBe("已完成");
    expect(view.tone).toBe("success");
    expect(view.resultUrl).toBe("/api/tasks/101/result");
    expect(states(view)).toEqual(["done", "done", "done"]);
  });

  it("FAILED：失败 · 失败阶段，显示原因；失败段标红，之后的段为灰色", () => {
    const view = deriveTaskView(taskFixture("failed"));
    expect(view.label).toBe("失败 · 模拟生成");
    expect(view.tone).toBe("failure");
    expect(view.hint).toBe("模拟生成失败：生成服务返回错误（模拟注入）");
    expect(states(view)).toEqual(["done", "failed", "skipped"]);
  });

  it("PROCESSING + 查询出错（503 或断网）：主文案不变，只附加提示，文案里没有「失败 ·」", () => {
    for (const error of [outage, offline]) {
      const view = deriveTaskView(taskFixture("processing"), { error });
      expect(view.label).toBe("处理中 · 模拟生成");
      expect(view.label).not.toContain("失败");
      expect(view.tone).toBe("processing");
      expect(view.queryProblem).toBe(QUERY_PROBLEM_TEXT);
      expect(QUERY_PROBLEM_TEXT).toBe("状态更新失败，任务仍在后台处理");
      expect(states(view)).not.toContain("failed");
    }
  });

  it("PENDING + 查询出错：仍然是等待处理", () => {
    const view = deriveTaskView(taskFixture("pending"), { error: outage });
    expect(view.label).toBe("等待处理");
    expect(view.queryProblem).toBe(QUERY_PROBLEM_TEXT);
  });

  it("终态任务的查询错误不影响显示", () => {
    const view = deriveTaskView(taskFixture("succeeded"), { error: offline });
    expect(view.label).toBe("已完成");
    expect(view.queryProblem).toBeNull();
  });

  it("查询返回 404：任务不存在", () => {
    const view = deriveTaskView(taskFixture("processing"), { error: notFound });
    expect(view.label).toBe("任务不存在");
    expect(view.notFound).toBe(true);
    expect(view.queryProblem).toBeNull();
  });
});
