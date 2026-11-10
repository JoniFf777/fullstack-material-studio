import type { MaterialDto } from "@/lib/api/types";

// 上传位状态机（spec/05 §7.2）。每个上传位独立；每次上传分配递增的 uploadId，
// 进度、成功、失败事件都带着它，和上传位当前的 uploadId 不一致的事件直接丢弃。

export type SlotState =
  | { status: "empty" }
  | { status: "invalid"; fileName: string; message: string }
  | { status: "uploading"; uploadId: number; file: File; previewUrl: string; progress: number }
  | { status: "ready"; uploadId: number; file: File; previewUrl: string; material: MaterialDto }
  | { status: "error"; uploadId: number; file: File; previewUrl: string; message: string };

export interface SlotsState {
  slots: SlotState[];
}

export type SlotsAction =
  | { type: "reject"; slot: number; fileName: string; message: string }
  | { type: "start"; slot: number; uploadId: number; file: File; previewUrl: string }
  | { type: "progress"; slot: number; uploadId: number; progress: number }
  | { type: "succeed"; slot: number; uploadId: number; material: MaterialDto }
  | { type: "fail"; slot: number; uploadId: number; message: string }
  | { type: "remove"; slot: number }
  | { type: "reset" };

export function initSlots(count: number): SlotsState {
  return { slots: Array.from({ length: count }, () => ({ status: "empty" as const })) };
}

function replace(state: SlotsState, index: number, next: SlotState): SlotsState {
  if (index < 0 || index >= state.slots.length) return state;
  return { slots: state.slots.map((slot, i) => (i === index ? next : slot)) };
}

export function uploadSlotsReducer(state: SlotsState, action: SlotsAction): SlotsState {
  switch (action.type) {
    case "reject":
      return replace(state, action.slot, { status: "invalid", fileName: action.fileName, message: action.message });
    case "start":
      return replace(state, action.slot, { status: "uploading", uploadId: action.uploadId, file: action.file, previewUrl: action.previewUrl, progress: 0 });
    case "progress": {
      const slot = state.slots[action.slot];
      if (slot?.status !== "uploading" || slot.uploadId !== action.uploadId) return state;
      return replace(state, action.slot, { ...slot, progress: Math.max(slot.progress, action.progress) });
    }
    case "succeed": {
      const slot = state.slots[action.slot];
      if (slot?.status !== "uploading" || slot.uploadId !== action.uploadId) return state;
      return replace(state, action.slot, { status: "ready", uploadId: slot.uploadId, file: slot.file, previewUrl: slot.previewUrl, material: action.material });
    }
    case "fail": {
      const slot = state.slots[action.slot];
      if (slot?.status !== "uploading" || slot.uploadId !== action.uploadId) return state;
      return replace(state, action.slot, { status: "error", uploadId: slot.uploadId, file: slot.file, previewUrl: slot.previewUrl, message: action.message });
    }
    case "remove":
      return replace(state, action.slot, { status: "empty" });
    case "reset":
      return initSlots(state.slots.length);
  }
}

export type SubmitReadiness =
  | { kind: "missing"; count: number }
  | { kind: "problem" }
  | { kind: "uploading" }
  | { kind: "ready"; materialIds: number[] };

/** 提交按钮的状态（spec/05 §7.3）：先看还缺几张，再看有没有出问题的，再看是否还在上传。 */
export function submitReadiness(slots: readonly SlotState[]): SubmitReadiness {
  const empty = slots.filter((s) => s.status === "empty").length;
  if (empty > 0) return { kind: "missing", count: empty };
  if (slots.some((s) => s.status === "invalid" || s.status === "error")) return { kind: "problem" };
  if (slots.some((s) => s.status === "uploading")) return { kind: "uploading" };
  return { kind: "ready", materialIds: slots.map((s) => (s.status === "ready" ? s.material.id : -1)) };
}
