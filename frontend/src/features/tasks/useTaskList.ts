"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@/features/auth/AuthProvider";
import { getTasks } from "@/lib/api/endpoints";
import type { TaskDto } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { mergeTask } from "./mergeTask";

/**
 * 任务列表：挂载时拉取一次，不轮询（spec/05 §8.1）。之后靠刷新按钮、窗口重新聚焦和提交成功来更新。
 * 列表里未完成的任务由各自的卡片（useTrackedTask）跟踪，所以刷新页面后也会继续更新。
 */
export function useTaskList(templateId: string | null) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.taskList(userId, templateId),
    queryFn: async ({ signal }) => {
      const items = await getTasks({ templateId, limit: 50 }, signal);
      // 列表可能比单个任务的缓存旧：合并后终态不会回退
      return items.map((task) => mergeTask(queryClient.getQueryData<TaskDto>(queryKeys.task(userId, task.id)), task));
    },
  });
}
