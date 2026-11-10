"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { StatePlaceholder } from "@/components/StatePlaceholder";
import type { TaskDto } from "@/lib/api/types";
import { ResultPreviewDialog } from "./ResultPreviewDialog";
import { TaskGrid } from "./TaskGrid";
import { useTaskList } from "./useTaskList";

/** 详情页右栏：当前用户在这个模板下的制作记录（UI-02、UI-03）。 */
export function HistoryPanel({ templateId }: { templateId: string }) {
  const tasks = useTaskList(templateId);
  const [preview, setPreview] = useState<TaskDto | null>(null);

  return (
    <section aria-labelledby="history-title" className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="history-title" className="text-base font-semibold">
          历史记录
        </h2>
        <button
          type="button"
          onClick={() => void tasks.refetch()}
          aria-label="刷新历史记录"
          title="刷新"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-zinc-800 hover:text-ink"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${tasks.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      <TaskGrid
        tasks={tasks.data}
        loading={tasks.isPending}
        failed={tasks.isError}
        onRetry={() => void tasks.refetch()}
        onOpenResult={setPreview}
        empty={<StatePlaceholder kind="empty" title="还没有制作记录" description="上传图片后点「立即制作」，任务会出现在这里。" />}
      />
      <ResultPreviewDialog task={preview} onClose={() => setPreview(null)} />
    </section>
  );
}
