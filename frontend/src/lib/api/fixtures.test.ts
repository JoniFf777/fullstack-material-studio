import { describe, expect, it } from "vitest";
import { FIXTURE_NAMES, fixture, taskFixture, type FixtureName } from "@/test/fixtures";
import { ContractError } from "./errors";
import { TASK_STAGES, TASK_STATUSES } from "./types";
import {
  apiErrorBody,
  categoryDto,
  itemsOf,
  materialDto,
  parse,
  simulationSettingsDto,
  taskDto,
  templateDetailDto,
  templateSummaryDto,
  userEnvelope,
  type Guard,
} from "./validate";

const GUARDS: Record<FixtureName, Guard<unknown>> = {
  user: userEnvelope,
  categories: itemsOf(categoryDto),
  templates: itemsOf(templateSummaryDto),
  "template-detail": templateDetailDto,
  material: materialDto,
  "task-pending": taskDto,
  "task-processing": taskDto,
  "task-succeeded": taskDto,
  "task-failed": taskDto,
  "task-list": itemsOf(taskDto),
  simulation: simulationSettingsDto,
  "error-validation": apiErrorBody,
  "error-not-found": apiErrorBody,
};

describe("verify/fixtures 与前端的响应校验", () => {
  it.each(FIXTURE_NAMES)("%s.json 能通过校验", (name) => {
    expect(() => parse(GUARDS[name], fixture(name))).not.toThrow();
  });

  it("任务夹具里的枚举值都在合法范围内", () => {
    const tasks = [
      ...(["pending", "processing", "succeeded", "failed"] as const).map((k) => taskFixture(k)),
      ...fixture<{ items: ReturnType<typeof taskFixture>[] }>("task-list").items,
    ];
    for (const task of tasks) {
      expect(TASK_STATUSES).toContain(task.status);
      for (const stage of [task.stage, task.failedStage]) if (stage !== null) expect(TASK_STAGES).toContain(stage);
      for (const step of task.steps) expect(TASK_STAGES).toContain(step.stage);
    }
  });

  it("校验能拒绝非法的枚举值和缺少的字段", () => {
    expect(() => parse(taskDto, { ...taskFixture("processing"), stage: "UPLOADING" })).toThrow(ContractError);
    const { updatedAt: _omit, ...withoutUpdatedAt } = taskFixture("pending");
    void _omit;
    expect(() => parse(taskDto, withoutUpdatedAt)).toThrow(/updatedAt/);
    expect(() => parse(simulationSettingsDto, { ...fixture<object>("simulation"), failStage: "BOGUS" })).toThrow(ContractError);
  });
});
