import type { StepVisual, TaskView } from "./taskView";

const BAR: Record<StepVisual, string> = {
  todo: "bg-white/15",
  active: "animate-pulse bg-brand",
  done: "bg-ok",
  failed: "bg-bad",
  skipped: "bg-white/10",
};

const TEXT: Record<StepVisual, string> = {
  todo: "text-zinc-400",
  active: "text-brand",
  done: "text-zinc-200",
  failed: "text-bad",
  skipped: "text-zinc-500 line-through",
};

// 状态不只靠颜色区分：屏幕阅读器会读出每一段的状态
const SPOKEN: Record<StepVisual, string> = {
  todo: "未开始",
  active: "进行中",
  done: "已完成",
  failed: "失败",
  skipped: "未执行",
};

export function StageSteps({ steps }: { steps: TaskView["steps"] }) {
  return (
    <ol aria-label="处理步骤" className="grid grid-cols-3 gap-1.5">
      {steps.map((step) => (
        <li key={step.stage} className="min-w-0">
          <span aria-hidden="true" className={`block h-1 rounded-full ${BAR[step.state]}`} />
          <span className={`mt-1 block truncate text-[11px] ${TEXT[step.state]}`}>
            {step.label}
            <span className="sr-only">：{SPOKEN[step.state]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
