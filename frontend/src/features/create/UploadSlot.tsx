"use client";

import { AlertCircle, Check, ImagePlus, RefreshCw, RotateCw, Trash2 } from "lucide-react";
import Image from "next/image";
import { useId, useRef } from "react";
import type { SlotState } from "./uploadSlotsReducer";

interface UploadSlotProps {
  index: number;
  state: SlotState;
  accept: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onRetry: () => void;
}

function statusText(state: SlotState): string {
  switch (state.status) {
    case "empty":
      return "未选择图片";
    case "invalid":
      return state.message;
    case "uploading":
      return `上传中 ${state.progress}%`;
    case "ready":
      return "已就绪";
    case "error":
      return state.message;
  }
}

const iconButton =
  "inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-zinc-800 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

export function UploadSlot({ index, state, accept, disabled = false, onSelect, onRemove, onRetry }: UploadSlotProps) {
  const inputId = useId();
  const statusId = `${inputId}-status`;
  const inputRef = useRef<HTMLInputElement>(null);
  const n = index + 1;
  const preview = state.status === "uploading" || state.status === "ready" || state.status === "error" ? state.previewUrl : null;
  const problem = state.status === "invalid" || state.status === "error";

  return (
    <div role="group" aria-label={`第 ${n} 张图片`} className="min-w-0">
      {/* 输入框视觉上隐藏但可以聚焦：Tab 到这里，按 Enter 或空格打开文件选择 */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={statusId}
        className="peer sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onSelect(file);
        }}
      />
      <label
        htmlFor={inputId}
        className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border bg-card text-center text-xs transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed ${
          problem ? "border-red-500/60" : state.status === "empty" ? "border-dashed border-line hover:border-zinc-500" : "border-line"
        }`}
      >
        {preview ? <Image src={preview} alt={`第 ${n} 张素材预览`} fill sizes="(min-width: 1024px) 180px, 45vw" className="object-cover" /> : null}

        {state.status === "empty" ? (
          <span className="flex flex-col items-center gap-2 px-3 text-muted">
            <ImagePlus aria-hidden="true" className="size-6" />
            点击上传第 {n} 张
          </span>
        ) : null}

        {state.status === "invalid" ? (
          <span className="flex flex-col items-center gap-2 px-3 text-bad">
            <AlertCircle aria-hidden="true" className="size-6" />
            {state.message}
            <span className="text-muted">点击重新选择</span>
          </span>
        ) : null}

        {state.status === "uploading" ? (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 pb-2 pt-1.5 text-white">
            上传中 {state.progress}%
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${state.progress}%` }} />
            </span>
          </span>
        ) : null}

        {state.status === "ready" ? (
          <span className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-ok text-brand-ink">
            <Check aria-hidden="true" className="size-4" />
          </span>
        ) : null}

        {state.status === "error" ? (
          <span className="absolute inset-x-0 bottom-0 flex items-start gap-1 bg-red-950/85 px-2 py-1.5 text-left text-red-100">
            <AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {state.message}
          </span>
        ) : null}
      </label>

      <div className="mt-1.5 flex items-center justify-between gap-1">
        <p id={statusId} className={`truncate text-xs ${problem ? "text-bad" : "text-muted"}`}>
          第 {n} 张 · {statusText(state)}
        </p>
        {state.status !== "empty" ? (
          <div className="flex shrink-0">
            {state.status === "error" ? (
              <button type="button" className={iconButton} disabled={disabled} onClick={onRetry} aria-label={`重试上传第 ${n} 张图片`} title="重试">
                <RotateCw aria-hidden="true" className="size-4" />
              </button>
            ) : null}
            <button type="button" className={iconButton} disabled={disabled} onClick={() => inputRef.current?.click()} aria-label={`替换第 ${n} 张图片`} title="替换">
              <RefreshCw aria-hidden="true" className="size-4" />
            </button>
            <button type="button" className={iconButton} disabled={disabled} onClick={onRemove} aria-label={`移除第 ${n} 张图片`} title="移除">
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
