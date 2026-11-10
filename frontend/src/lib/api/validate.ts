// 响应的运行时校验（契约守卫）：只检查前端用到的字段是否存在、类型和枚举是否正确。
// 不合法时抛 ContractError，让前后端不一致尽早暴露，而不是在界面上悄悄出错。
import { ContractError } from "./errors";
import {
  STEP_STATUSES,
  TASK_STAGES,
  TASK_STATUSES,
  type ApiErrorBody,
  type CategoryDto,
  type FieldError,
  type MaterialDto,
  type SimulationSettingsDto,
  type TaskDto,
  type TaskMaterialDto,
  type TaskStepDto,
  type TemplateDetailDto,
  type TemplateSummaryDto,
  type UserDto,
} from "./types";

export type Guard<T> = (value: unknown, path: string) => T;

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return `"${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
  return typeof value;
}

function fail(path: string, expected: string, value: unknown): never {
  throw new ContractError(path, `应为 ${expected}，实际为 ${describe(value)}`);
}

export const str: Guard<string> = (v, p) => (typeof v === "string" ? v : fail(p, "string", v));
export const int: Guard<number> = (v, p) => (Number.isInteger(v) ? (v as number) : fail(p, "整数", v));
export const bool: Guard<boolean> = (v, p) => (typeof v === "boolean" ? v : fail(p, "boolean", v));

export const timestamp: Guard<string> = (v, p) => {
  const s = str(v, p);
  return Number.isNaN(Date.parse(s)) ? fail(p, "ISO-8601 时间", v) : s;
};

export function nullable<T>(guard: Guard<T>): Guard<T | null> {
  return (v, p) => (v === null ? null : guard(v, p));
}

export function oneOf<T extends string>(values: readonly T[]): Guard<T> {
  return (v, p) => (typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : fail(p, values.join(" | "), v));
}

export function arrayOf<T>(guard: Guard<T>): Guard<T[]> {
  return (v, p) => (Array.isArray(v) ? v.map((item, i) => guard(item, `${p}[${i}]`)) : fail(p, "array", v));
}

export function object<T>(shape: { [K in keyof T]-?: Guard<T[K]> }): Guard<T> {
  return (v, p) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) fail(p, "object", v);
    const record = v as Record<string, unknown>;
    const out = {} as T;
    for (const key of Object.keys(shape) as (keyof T & string)[]) {
      if (!Object.hasOwn(record, key)) throw new ContractError(`${p}.${key}`, "缺少字段");
      out[key] = shape[key](record[key], `${p}.${key}`);
    }
    return out;
  };
}

export function parse<T>(guard: Guard<T>, value: unknown, root = "$"): T {
  return guard(value, root);
}

export const userDto = object<UserDto>({ id: int, username: str, displayName: str, createdAt: timestamp });
export const userEnvelope = object<{ user: UserDto }>({ user: userDto });

export const categoryDto = object<CategoryDto>({ code: str, name: str, templateCount: int });

const summaryShape = {
  id: str,
  title: str,
  categoryCode: str,
  categoryName: str,
  coverUrl: str,
  requiredImageCount: int,
};
export const templateSummaryDto = object<TemplateSummaryDto>(summaryShape);
export const templateDetailDto = object<TemplateDetailDto>({
  ...summaryShape,
  description: str,
  acceptedMimeTypes: arrayOf(str),
  maxFileSizeBytes: int,
});

export const materialDto = object<MaterialDto>({
  id: int,
  originalName: str,
  mimeType: str,
  sizeBytes: int,
  url: str,
  createdAt: timestamp,
});

const taskStage = oneOf(TASK_STAGES);

export const taskStepDto = object<TaskStepDto>({
  stage: taskStage,
  status: oneOf(STEP_STATUSES),
  startedAt: timestamp,
  finishedAt: nullable(timestamp),
  message: nullable(str),
});

export const taskMaterialDto = object<TaskMaterialDto>({ slotIndex: int, materialId: int, url: str });

export const taskDto = object<TaskDto>({
  id: int,
  templateId: str,
  templateTitle: str,
  coverUrl: str,
  status: oneOf(TASK_STATUSES),
  stage: nullable(taskStage),
  failedStage: nullable(taskStage),
  errorCode: nullable(str),
  errorMessage: nullable(str),
  resultUrl: nullable(str),
  materials: arrayOf(taskMaterialDto),
  steps: arrayOf(taskStepDto),
  createdAt: timestamp,
  startedAt: nullable(timestamp),
  finishedAt: nullable(timestamp),
  updatedAt: timestamp,
});

export const simulationSettingsDto = object<SimulationSettingsDto>({
  failStage: oneOf([...TASK_STAGES, "NONE"] as const),
  delaysMs: object<Record<(typeof TASK_STAGES)[number], number>>({ MATERIAL_CHECK: int, GENERATING: int, RESULT_ASSEMBLY: int }),
  queryOutage: bool,
});

export const apiErrorBody = object<ApiErrorBody>({
  code: str,
  message: str,
  fieldErrors: arrayOf(object<FieldError>({ field: str, message: str })),
});

export function itemsOf<T>(guard: Guard<T>): Guard<{ items: T[] }> {
  return object<{ items: T[] }>({ items: arrayOf(guard) });
}
