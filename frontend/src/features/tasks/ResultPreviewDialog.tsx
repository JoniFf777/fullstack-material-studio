"use client";

import { Download } from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";
import { Dialog } from "@/components/Dialog";
import type { TaskDto } from "@/lib/api/types";
import { STAGE_LABELS, formatDateTime, formatDuration, stepDurationMs } from "@/lib/format";

/** 结果大图预览：原生 <dialog>，关闭后浏览器把焦点还给打开它的卡片按钮。 */
export function ResultPreviewDialog({ task, onClose }: { task: TaskDto | null; onClose: () => void }) {
  return (
    <Dialog open={task !== null} onClose={onClose} title={task ? `${task.templateTitle} · 任务 #${task.id}` : "结果预览"} className="w-[min(94vw,40rem)]">
      {task?.resultUrl ? (
        <>
          <div className="relative mx-auto aspect-3/4 max-h-[60vh] overflow-hidden rounded-xl bg-card">
            <Image src={task.resultUrl} alt={`${task.templateTitle}的制作结果`} fill sizes="600px" className="object-contain" />
          </div>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted">创建时间</dt>
            <dd>{formatDateTime(task.createdAt)}</dd>
            <dt className="text-muted">完成时间</dt>
            <dd>{task.finishedAt ? formatDateTime(task.finishedAt) : "—"}</dd>
            {task.steps.map((step) => {
              const ms = stepDurationMs(step);
              return (
                <Fragment key={step.stage}>
                  <dt className="text-muted">{STAGE_LABELS[step.stage]}</dt>
                  <dd>{ms === null ? "—" : formatDuration(ms)}</dd>
                </Fragment>
              );
            })}
          </dl>
          <a
            href={task.resultUrl}
            download={`task-${task.id}.jpg`}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm hover:bg-zinc-800"
          >
            <Download aria-hidden="true" className="size-4" />
            下载原图
          </a>
        </>
      ) : null}
    </Dialog>
  );
}
