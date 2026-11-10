import type { QueryClient } from "@tanstack/react-query";
import type { TaskDto } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";

/** 提交成功（202）后，把新任务插到该模板和"全部"两份任务列表缓存的最前面。列表还没缓存时不动它。 */
export function addSubmittedTask(queryClient: QueryClient, userId: number, task: TaskDto): void {
  queryClient.setQueryData<TaskDto>(queryKeys.task(userId, task.id), task);
  const upsert = (list: TaskDto[] | undefined) => (list === undefined ? undefined : [task, ...list.filter((t) => t.id !== task.id)]);
  queryClient.setQueryData<TaskDto[]>(queryKeys.taskList(userId, task.templateId), upsert);
  queryClient.setQueryData<TaskDto[]>(queryKeys.taskList(userId, null), upsert);
}
