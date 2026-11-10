import { apiFetch } from "./client";
import type { CategoryDto, SimulationSettingsDto, TaskDto, TemplateDetailDto, TemplateSummaryDto, UserDto } from "./types";
import {
  categoryDto,
  itemsOf,
  parse,
  simulationSettingsDto,
  taskDto,
  templateDetailDto,
  templateSummaryDto,
  userEnvelope,
} from "./validate";

// ── 账号 ──

export async function getMe(signal?: AbortSignal): Promise<UserDto> {
  return parse(userEnvelope, await apiFetch("/api/auth/me", { signal, checkUser: false })).user;
}

export async function login(username: string, password: string): Promise<UserDto> {
  const body = await apiFetch("/api/auth/login", { method: "POST", json: { username, password }, checkUser: false });
  return parse(userEnvelope, body).user;
}

export async function register(input: { username: string; password: string; displayName?: string }): Promise<UserDto> {
  const body = await apiFetch("/api/auth/register", { method: "POST", json: input, checkUser: false });
  return parse(userEnvelope, body).user;
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST", checkUser: false });
}

// ── 模板 ──

export async function getCategories(signal?: AbortSignal): Promise<CategoryDto[]> {
  return parse(itemsOf(categoryDto), await apiFetch("/api/categories", { signal })).items;
}

export async function getTemplates(category: string | null, signal?: AbortSignal): Promise<TemplateSummaryDto[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return parse(itemsOf(templateSummaryDto), await apiFetch(`/api/templates${query}`, { signal })).items;
}

export async function getTemplate(id: string, signal?: AbortSignal): Promise<TemplateDetailDto> {
  return parse(templateDetailDto, await apiFetch(`/api/templates/${encodeURIComponent(id)}`, { signal }));
}

// ── 任务 ──

export async function submitTask(templateId: string, materialIds: number[], idempotencyKey: string): Promise<TaskDto> {
  const body = await apiFetch("/api/tasks", {
    method: "POST",
    json: { templateId, materialIds },
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return parse(taskDto, body);
}

export async function getTasks(options: { templateId?: string | null; limit?: number } = {}, signal?: AbortSignal): Promise<TaskDto[]> {
  const params = new URLSearchParams();
  if (options.templateId) params.set("templateId", options.templateId);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.size ? `?${params.toString()}` : "";
  return parse(itemsOf(taskDto), await apiFetch(`/api/tasks${query}`, { signal })).items;
}

export async function getTask(id: number, signal?: AbortSignal): Promise<TaskDto> {
  return parse(taskDto, await apiFetch(`/api/tasks/${id}`, { signal }));
}

// ── 开发接口（DEV_API_ENABLED=true 时存在） ──

export async function getSimulation(signal?: AbortSignal): Promise<SimulationSettingsDto> {
  return parse(simulationSettingsDto, await apiFetch("/api/dev/simulation", { signal, checkUser: false }));
}

export async function patchSimulation(patch: Partial<SimulationSettingsDto> & { delaysMs?: Partial<SimulationSettingsDto["delaysMs"]> }): Promise<SimulationSettingsDto> {
  return parse(simulationSettingsDto, await apiFetch("/api/dev/simulation", { method: "PATCH", json: patch, checkUser: false }));
}

export async function resetSimulation(): Promise<SimulationSettingsDto> {
  return parse(simulationSettingsDto, await apiFetch("/api/dev/simulation/reset", { method: "POST", checkUser: false }));
}
