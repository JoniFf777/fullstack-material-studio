"use client";

import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import Image from "next/image";
import { Spinner } from "@/components/Spinner";
import type { TaskDto } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { StageSteps } from "./StageSteps";
import { deriveTaskView, type TaskView } from "./taskView";
import { useTrackedTask } from "./useTrackedTask";

const TONE_TEXT: Record<TaskView["tone"], string> = {
  pending: "text-zinc-100",
  processing: "text-brand",
  success: "text-ok",
  failure: "text-bad",
  missing: "text-zinc-400",
};

function ToneIcon({ tone }: { tone: TaskView["tone"] }) {
  if (tone === "pending" || tone === "processing") return <Spinner className="size-4" />;
  if (tone === "success") return <CircleCheck aria-hidden="true" className="size-4" />;
  if (tone === "failure") return <CircleAlert aria-hidden="true" className="size-4" />;
  return <CircleHelp aria-hidden="true" className="size-4" />;
}

interface TaskCardProps {
  task: TaskDto;
  showTemplate?: boolean;
  onOpenResult: (task: TaskDto) => void;
}

export function TaskCard({ task: listTask, showTemplate = false, onOpenResult }: TaskCardProps) {
  const tracked = useTrackedTask(listTask);
  const task = tracked.task;
  const view = deriveTaskView(task, { error: tracked.error });
  const now = useNow();

  return (
    <article aria-label={`任务 #${task.id}`} className="relative flex aspect-3/4 flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-line">
      {view.resultUrl ? (
        <Image src={view.resultUrl} alt={`${task.templateTitle}的制作结果`} fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 45vw" className="object-cover" />
      ) : (
        <Image src={task.coverUrl} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 45vw" className="object-cover opacity-35" />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-black/60 via-black/10 to-black/85" />

      <div className="relative flex items-start justify-between gap-2 p-3 text-xs text-zinc-300">
        <div className="min-w-0">
          {showTemplate ? <p className="truncate text-sm font-medium text-white">{task.templateTitle}</p> : null}
          <time dateTime={task.createdAt} title={formatDateTime(task.createdAt)}>
            {formatRelative(task.createdAt, now)}
          </time>
        </div>
        <span className="shrink-0 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[11px]">#{task.id}</span>
      </div>

      <div className="relative mt-auto space-y-2 p-3">
        <p role="status" className={`flex items-center gap-1.5 text-sm font-semibold ${TONE_TEXT[view.tone]}`}>
          <ToneIcon tone={view.tone} />
          {view.label}
        </p>
        {view.hint ? <p className={`line-clamp-3 text-xs ${view.tone === "failure" ? "text-red-200" : "text-zinc-300"}`}>{view.hint}</p> : null}
        <StageSteps steps={view.steps} />
        {view.queryProblem ? (
          <div role="alert" className="relative z-20 rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs text-warn">
            <p>{view.queryProblem}</p>
            <button type="button" onClick={tracked.refetch} aria-label={`重新查询任务 #${task.id}`} className="mt-1 font-medium underline underline-offset-2">
              重新查询
            </button>
          </div>
        ) : null}
      </div>

      {view.resultUrl ? (
        <button type="button" onClick={() => onOpenResult(task)} aria-label={`查看任务 #${task.id} 的结果大图`} className="absolute inset-0 z-10 rounded-2xl" />
      ) : null}
    </article>
  );
}
