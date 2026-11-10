import type { QueryClient } from "@tanstack/react-query";
import type { TaskDto } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { mergeTask } from "./mergeTask";

/** 提交成功（202）后，把新任务插到该模板和"全部"两份任务列表缓存的最前面。列表还没缓存时不动它。 */
export function addSubmittedTask(queryClient: QueryClient, userId: number, task: TaskDto): void {
  queryClient.setQueryData<TaskDto>(queryKeys.task(userId, task.id), (prev) => mergeTask(prev, task));
  const upsert = (list: TaskDto[] | undefined) =>
    list === undefined ? undefined : [mergeTask(list.find((t) => t.id === task.id), task), ...list.filter((t) => t.id !== task.id)];
  queryClient.setQueryData<TaskDto[]>(queryKeys.taskList(userId, task.templateId), upsert);
  queryClient.setQueryData<TaskDto[]>(queryKeys.taskList(userId, null), upsert);
}

/** 单个任务查到新数据后写回该用户所有任务列表，保证列表、筛选计数和卡片一致。 */
export function syncTaskIntoLists(queryClient: QueryClient, userId: number, task: TaskDto): void {
  queryClient.setQueriesData<TaskDto[]>({ queryKey: queryKeys.taskLists(userId) }, (list) => {
    if (!list) return list;
    let changed = false;
    const next = list.map((item) => {
      if (item.id !== task.id) return item;
      const merged = mergeTask(item, task);
      if (merged !== item) changed = true;
      return merged;
    });
    return changed ? next : list;
  });
}
