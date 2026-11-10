// 与 spec/03 §2 一致。改契约时先改 03，再同步这里和 verify/fixtures。

export const TASK_STATUSES = ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED"] as const;
export const TASK_STAGES = ["MATERIAL_CHECK", "GENERATING", "RESULT_ASSEMBLY"] as const;
export const STEP_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskStage = (typeof TASK_STAGES)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];

export interface UserDto {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface CategoryDto {
  code: string;
  name: string;
  templateCount: number;
}

export interface TemplateSummaryDto {
  id: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  coverUrl: string;
  requiredImageCount: number;
}

export interface TemplateDetailDto extends TemplateSummaryDto {
  description: string;
  acceptedMimeTypes: string[];
  maxFileSizeBytes: number;
}

export interface MaterialDto {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface TaskStepDto {
  stage: TaskStage;
  status: StepStatus;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
}

export interface TaskMaterialDto {
  slotIndex: number;
  materialId: number;
  url: string;
}

export interface TaskDto {
  id: number;
  templateId: string;
  templateTitle: string;
  coverUrl: string;
  status: TaskStatus;
  stage: TaskStage | null;
  failedStage: TaskStage | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultUrl: string | null;
  materials: TaskMaterialDto[];
  steps: TaskStepDto[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface SimulationSettingsDto {
  failStage: TaskStage | "NONE";
  delaysMs: Record<TaskStage, number>;
  queryOutage: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors: FieldError[];
}

export function isTerminal(status: TaskStatus): boolean {
  return status === "SUCCEEDED" || status === "FAILED";
}
