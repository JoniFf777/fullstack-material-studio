"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { StatePlaceholder } from "@/components/StatePlaceholder";
import type { TaskDto } from "@/lib/api/types";
import { TaskCard } from "./TaskCard";

interface TaskGridProps {
  tasks: TaskDto[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpenResult: (task: TaskDto) => void;
  empty: ReactNode;
  showTemplate?: boolean;
  columns?: string;
}

export function TaskGrid({ tasks, loading, failed, onRetry, onOpenResult, empty, showTemplate = false, columns = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" }: TaskGridProps) {
  if (loading) {
    return (
      <div role="status" aria-label="历史加载中" className={`grid gap-3 ${columns}`}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-3/4 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }
  if (failed && !tasks) {
    return <StatePlaceholder kind="error" title="历史加载失败" description="网络或服务暂时不可用" action={<Button onClick={onRetry}>重试</Button>} />;
  }
  if (!tasks || tasks.length === 0) return <>{empty}</>;
  return (
    <ul className={`grid gap-3 ${columns}`}>
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} showTemplate={showTemplate} onOpenResult={onOpenResult} />
        </li>
      ))}
    </ul>
  );
}
