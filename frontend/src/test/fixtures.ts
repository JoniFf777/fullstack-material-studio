// 测试里的假响应都来自 verify/fixtures（与 spec/03 §2 一一对应的契约样例）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskDto } from "@/lib/api/types";

export const FIXTURE_NAMES = [
  "user",
  "categories",
  "templates",
  "template-detail",
  "material",
  "task-pending",
  "task-processing",
  "task-succeeded",
  "task-failed",
  "task-list",
  "simulation",
  "error-validation",
  "error-not-found",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

function fixtureDir(): string {
  const dir = process.env.VERIFY_FIXTURE_DIR;
  if (!dir) throw new Error("没有设置 VERIFY_FIXTURE_DIR（见 vitest.config.mts）");
  return dir;
}

export function fixture<T = unknown>(name: FixtureName): T {
  return JSON.parse(readFileSync(join(fixtureDir(), `${name}.json`), "utf8")) as T;
}

/** 以某个状态的任务夹具为底，覆盖部分字段，例如 taskFixture("processing", { id: 2 }) */
export function taskFixture(kind: "pending" | "processing" | "succeeded" | "failed", patch: Partial<TaskDto> = {}): TaskDto {
  return { ...fixture<TaskDto>(`task-${kind}`), ...patch };
}
