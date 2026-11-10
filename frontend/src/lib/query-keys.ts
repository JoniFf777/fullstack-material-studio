// 和用户相关的 key 都以 ['u', userId] 开头：切换用户后，新旧用户的数据在缓存里天然分开。
export const queryKeys = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  templates: (category: string | null) => ["templates", category ?? "all"] as const,
  template: (id: string) => ["template", id] as const,
  taskLists: (userId: number) => ["u", userId, "tasks"] as const,
  taskList: (userId: number, templateId?: string | null) => ["u", userId, "tasks", templateId ?? "all"] as const,
  task: (userId: number, taskId: number) => ["u", userId, "task", taskId] as const,
};
