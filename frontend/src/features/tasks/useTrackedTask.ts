"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@/features/auth/AuthProvider";
import { getTask } from "@/lib/api/endpoints";
import { isTerminal, type TaskDto } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { mergeTask } from "./mergeTask";
import { syncTaskIntoLists } from "./taskCache";

export const POLL_INTERVAL_MS = 1500;

/**
 * 跟踪单个任务（spec/05 §8.2）：
 * - 只跟踪未完成的任务；任务结束就停（refetchInterval 返回 false）
 * - 查询出错（客户端已按默认值重试过一次）时暂停轮询，等用户点"重新查询"、窗口重新聚焦或网络恢复
 * - 标签页隐藏时暂停；卡片卸载后没有观察者，轮询停止，进行中的请求通过 signal 取消
 */
export function useTrackedTask(task: TaskDto) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const key = queryKeys.task(userId, task.id);

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const fresh = await getTask(task.id, signal);
      const merged = mergeTask(queryClient.getQueryData<TaskDto>(key), fresh);
      syncTaskIntoLists(queryClient, userId, merged);
      return merged;
    },
    initialData: task,
    enabled: !isTerminal(task.status),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data || isTerminal(data.status) || q.state.status === "error") return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });

  return {
    task: mergeTask(task, query.data),
    error: query.isError ? query.error : null,
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
  };
}
