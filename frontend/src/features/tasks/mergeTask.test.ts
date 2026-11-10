import { describe, expect, it } from "vitest";
import { taskFixture } from "@/test/fixtures";
import { mergeTask } from "./mergeTask";

const pending = taskFixture("pending");
const processing = taskFixture("processing");
const succeeded = taskFixture("succeeded");
const failed = taskFixture("failed");

describe("mergeTask", () => {
  it("没有旧数据时用新数据", () => {
    expect(mergeTask(undefined, processing)).toBe(processing);
    expect(mergeTask(null, pending)).toBe(pending);
  });

  it("正常的推进会被接受", () => {
    expect(mergeTask(pending, processing)).toBe(processing);
    expect(mergeTask(processing, succeeded)).toBe(succeeded);
  });

  it("终态不会被非终态覆盖", () => {
    const lateProcessing = { ...processing, updatedAt: "2026-11-10T09:00:00.000Z" };
    expect(mergeTask(succeeded, lateProcessing)).toBe(succeeded);
    expect(mergeTask(failed, { ...failed, status: "PROCESSING" as const, failedStage: null, updatedAt: "2026-11-10T09:00:00.000Z" })).toBe(failed);
  });

  it("updatedAt 更旧的数据被忽略", () => {
    const older = { ...processing, stage: "MATERIAL_CHECK" as const, updatedAt: "2026-11-10T08:31:00.015Z" };
    expect(mergeTask(processing, older)).toBe(processing);
  });

  it("按时间先后比较，不做字符串比较（小数位数不同时字符串比较会出错）", () => {
    const newer = { ...processing, updatedAt: "2026-11-10T08:31:02.500Z" };
    // 字符串上 "02Z" > "02.500Z"，但时间上更早
    const older = { ...processing, stage: "MATERIAL_CHECK" as const, updatedAt: "2026-11-10T08:31:02Z" };
    expect(mergeTask(newer, older)).toBe(newer);
    expect(mergeTask(older, newer)).toBe(newer);
  });

  it("updatedAt 相同时用新数据（步骤完成不一定改动任务的 updatedAt）", () => {
    const sameTime = { ...processing, steps: processing.steps.map((s) => ({ ...s })) };
    expect(mergeTask(processing, sameTime)).toBe(sameTime);
  });
});
