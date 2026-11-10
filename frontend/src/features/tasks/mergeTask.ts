import { isTerminal, type TaskDto } from "@/lib/api/types";

/**
 * 新数据写入缓存之前先和旧数据合并（spec/05 §8.3）：
 * - 旧数据是终态、新数据不是：保留旧数据（终态不回退）
 * - 新数据的 updatedAt 早于旧数据：保留旧数据（按时间比较；服务端小数位数可能不同，不能比较字符串）
 * - 其他情况用新数据（updatedAt 相同时也用新数据：步骤完成不一定会改动任务的 updatedAt）
 */
export function mergeTask(prev: TaskDto | null | undefined, next: TaskDto): TaskDto {
  if (!prev || prev.id !== next.id) return next;
  if (isTerminal(prev.status) && !isTerminal(next.status)) return prev;
  if (Date.parse(next.updatedAt) < Date.parse(prev.updatedAt)) return prev;
  return next;
}
