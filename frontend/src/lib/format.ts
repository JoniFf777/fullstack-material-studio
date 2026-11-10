import { TASK_STAGES, type TaskStage, type TaskStatus, type TaskStepDto } from "./api/types";

// 中文显示名与 spec/03 §6 一致
export const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "等待处理",
  PROCESSING: "处理中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
};

export const STAGE_LABELS: Record<TaskStage, string> = {
  MATERIAL_CHECK: "素材检查",
  GENERATING: "模拟生成",
  RESULT_ASSEMBLY: "结果整理",
};

export const STAGE_ORDER: readonly TaskStage[] = TASK_STAGES;

const MIME_LABELS: Record<string, string> = { "image/jpeg": "JPG", "image/png": "PNG" };

export function mimeLabel(mime: string): string {
  return MIME_LABELS[mime] ?? mime.replace(/^image\//, "").toUpperCase();
}

export function acceptedTypesLabel(types: readonly string[]): string {
  return types.map(mimeLabel).join(" / ");
}

export function formatBytes(bytes: number): string {
  const kb = 1024;
  const mb = 1024 * 1024;
  if (bytes >= mb) {
    const value = bytes / mb;
    return `${Number.isInteger(value) ? value : value.toFixed(1)}MB`;
  }
  if (bytes >= kb) return `${Math.round(bytes / kb)}KB`;
  return `${bytes}B`;
}

const dateTimeFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.floor(Math.max(0, now - Date.parse(iso)) / 1000);
  if (seconds < 45) return "刚刚";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return formatDateTime(iso).slice(0, 10);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} 毫秒`;
  return `${(ms / 1000).toFixed(1)} 秒`;
}

export function stepDurationMs(step: TaskStepDto): number | null {
  return step.finishedAt ? Math.max(0, Date.parse(step.finishedAt) - Date.parse(step.startedAt)) : null;
}
