"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";
import { StatePlaceholder } from "@/components/StatePlaceholder";
import type { TaskDto } from "@/lib/api/types";
import { ResultPreviewDialog } from "./ResultPreviewDialog";
import { TaskGrid } from "./TaskGrid";
import { useTaskList } from "./useTaskList";

type FilterKey = "all" | "active" | "succeeded" | "failed";

const FILTERS: { key: FilterKey; label: string; match: (t: TaskDto) => boolean }[] = [
  { key: "all", label: "全部", match: () => true },
  { key: "active", label: "进行中", match: (t) => t.status === "PENDING" || t.status === "PROCESSING" },
  { key: "succeeded", label: "已完成", match: (t) => t.status === "SUCCEEDED" },
  { key: "failed", label: "失败", match: (t) => t.status === "FAILED" },
];

/** /history：当前用户的全部任务，状态筛选在前端完成。数据来自后端，刷新后仍然在。 */
export function HistoryView() {
  const tasks = useTaskList(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [preview, setPreview] = useState<TaskDto | null>(null);
  const items = tasks.data;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = items?.filter(active.match);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">我的作品</h1>
          <p className="mt-1 text-sm text-muted">任务记录保存在服务端，刷新页面或重新登录后仍然可以看到；未完成的任务会继续更新。</p>
        </div>
        <Button icon={<RefreshCw aria-hidden="true" className={`size-4 ${tasks.isFetching ? "animate-spin" : ""}`} />} onClick={() => void tasks.refetch()}>
          刷新
        </Button>
      </div>

      <div role="group" aria-label="按状态筛选" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm transition-colors ${
              filter === f.key ? "bg-ink font-medium text-page" : "bg-card text-muted hover:bg-zinc-800 hover:text-ink"
            }`}
          >
            {f.label}
            {items ? <span className="text-xs opacity-70">{items.filter(f.match).length}</span> : null}
          </button>
        ))}
      </div>

      <TaskGrid
        tasks={visible}
        loading={tasks.isPending}
        failed={tasks.isError}
        onRetry={() => void tasks.refetch()}
        onOpenResult={setPreview}
        showTemplate
        columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        empty={
          items && items.length > 0 ? (
            <StatePlaceholder kind="empty" title="没有符合条件的作品" />
          ) : (
            <StatePlaceholder
              kind="empty"
              title="还没有作品"
              action={
                <Link href="/" className="text-sm text-brand underline underline-offset-4">
                  去挑个模板
                </Link>
              }
            />
          )
        }
      />
      <ResultPreviewDialog task={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
