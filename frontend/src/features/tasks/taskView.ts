import { errorCode } from "@/lib/api/errors";
import { TASK_STAGES, isTerminal, type TaskDto, type TaskStage } from "@/lib/api/types";
import { STAGE_LABELS } from "@/lib/format";

// 卡片视图模型（spec/05 §8.4）。纯函数，界面上显示什么由这里决定。

export const QUERY_PROBLEM_TEXT = "状态更新失败，任务仍在后台处理";

export type StepVisual = "todo" | "active" | "done" | "failed" | "skipped";

export interface TaskView {
  label: string;
  tone: "pending" | "processing" | "success" | "failure" | "missing";
  hint: string | null;
  steps: { stage: TaskStage; label: string; state: StepVisual }[];
  resultUrl: string | null;
  /** 非终态任务查询出错时的附加提示；有值时主文案保持不变，绝不显示成"失败"。 */
  queryProblem: string | null;
  notFound: boolean;
}

function steps(states: (stage: TaskStage, index: number) => StepVisual): TaskView["steps"] {
  return TASK_STAGES.map((stage, index) => ({ stage, label: STAGE_LABELS[stage], state: states(stage, index) }));
}

function fromRecords(task: TaskDto): TaskView["steps"] {
  return steps((stage) => {
    const record = task.steps.find((s) => s.stage === stage);
    if (!record) return task.stage === stage ? "active" : "todo";
    if (record.status === "RUNNING") return "active";
    return record.status === "SUCCEEDED" ? "done" : "failed";
  });
}

export function deriveTaskView(task: TaskDto, query: { error?: unknown } = {}): TaskView {
  if (query.error && errorCode(query.error) === "TASK_NOT_FOUND") {
    return { label: "任务不存在", tone: "missing", hint: null, steps: steps(() => "todo"), resultUrl: null, queryProblem: null, notFound: true };
  }
  // 查询出错只影响"能不能看到最新状态"，不改变任务本身的状态
  const queryProblem = query.error && !isTerminal(task.status) ? QUERY_PROBLEM_TEXT : null;

  switch (task.status) {
    case "PENDING":
      return { label: "等待处理", tone: "pending", hint: "排队中", steps: steps(() => "todo"), resultUrl: null, queryProblem, notFound: false };
    case "PROCESSING":
      return {
        label: task.stage ? `处理中 · ${STAGE_LABELS[task.stage]}` : "处理中",
        tone: "processing",
        hint: null,
        steps: fromRecords(task),
        resultUrl: null,
        queryProblem,
        notFound: false,
      };
    case "SUCCEEDED":
      return { label: "已完成", tone: "success", hint: null, steps: steps(() => "done"), resultUrl: task.resultUrl, queryProblem: null, notFound: false };
    case "FAILED": {
      const failedIndex = task.failedStage ? TASK_STAGES.indexOf(task.failedStage) : -1;
      return {
        label: task.failedStage ? `失败 · ${STAGE_LABELS[task.failedStage]}` : "失败",
        tone: "failure",
        hint: task.errorMessage,
        steps: steps((_, index) => (failedIndex < 0 ? "skipped" : index < failedIndex ? "done" : index === failedIndex ? "failed" : "skipped")),
        resultUrl: null,
        queryProblem: null,
        notFound: false,
      };
    }
  }
}
