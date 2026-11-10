"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { useUserId } from "@/features/auth/AuthProvider";
import { addSubmittedTask } from "@/features/tasks/taskCache";
import { submitTask } from "@/lib/api/endpoints";
import { ApiError, errorMessage, isAbortError } from "@/lib/api/errors";
import type { TemplateDetailDto } from "@/lib/api/types";
import { uploadMaterial, type UploadHandle } from "@/lib/api/upload";
import { newIdempotencyKey } from "@/lib/ids";
import { queryKeys } from "@/lib/query-keys";
import { UploadSlot } from "./UploadSlot";
import { initSlots, submitReadiness, uploadSlotsReducer } from "./uploadSlotsReducer";
import { validateFile } from "./validateFile";

interface Notice {
  tone: "ok" | "error";
  text: string;
}

export function CreatePanel({ template }: { template: TemplateDetailDto }) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(uploadSlotsReducer, template.requiredImageCount, initSlots);
  const [notice, setNotice] = useState<Notice | null>(null);
  const handles = useRef(new Map<number, UploadHandle>());
  const previews = useRef(new Map<number, string>());
  const uploadSeq = useRef(0);
  const idempotency = useRef<{ combo: string; key: string } | null>(null);
  const submitting = useRef(false);

  // 离开页面时：中止上传，释放本地预览
  useEffect(() => {
    const activeHandles = handles.current;
    const activePreviews = previews.current;
    return () => {
      activeHandles.forEach((handle) => handle.abort());
      activePreviews.forEach((url) => URL.revokeObjectURL(url));
      activeHandles.clear();
      activePreviews.clear();
    };
  }, []);

  // "已提交"的提示几秒后自动消失
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const release = useCallback((slot: number) => {
    handles.current.get(slot)?.abort();
    handles.current.delete(slot);
    const url = previews.current.get(slot);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(slot);
  }, []);

  const startUpload = useCallback(
    (slot: number, file: File) => {
      release(slot);
      setNotice(null);
      const problem = validateFile(file, template);
      if (problem) {
        dispatch({ type: "reject", slot, fileName: file.name, message: problem });
        return;
      }
      uploadSeq.current += 1;
      const uploadId = uploadSeq.current;
      const previewUrl = URL.createObjectURL(file);
      previews.current.set(slot, previewUrl);
      dispatch({ type: "start", slot, uploadId, file, previewUrl });
      const handle = uploadMaterial(file, template.id, (progress) => dispatch({ type: "progress", slot, uploadId, progress }));
      handles.current.set(slot, handle);
      handle.promise
        .then(
          (material) => dispatch({ type: "succeed", slot, uploadId, material }),
          (error: unknown) => {
            if (!isAbortError(error)) dispatch({ type: "fail", slot, uploadId, message: errorMessage(error, "上传失败，请重试") });
          },
        )
        .finally(() => {
          if (handles.current.get(slot) === handle) handles.current.delete(slot);
        });
    },
    [release, template],
  );

  const removeSlot = (slot: number) => {
    release(slot);
    dispatch({ type: "remove", slot });
  };

  const mutation = useMutation({
    mutationFn: (vars: { materialIds: number[]; key: string }) => submitTask(template.id, vars.materialIds, vars.key),
    onSuccess: (task) => {
      addSubmittedTask(queryClient, userId, task);
      for (let i = 0; i < template.requiredImageCount; i += 1) release(i);
      dispatch({ type: "reset" });
      idempotency.current = null;
      setNotice({ tone: "ok", text: `已提交，任务 #${task.id} 已进入队列` });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.kind === "http" && (error.status ?? 500) < 500) {
        // 4xx：显示原因，保留上传位
        setNotice({ tone: "error", text: error.message });
        return;
      }
      // 网络错误：保留上传位和 Idempotency-Key，重试不会重复建任务；刷新列表，任务若其实已建好也能看到
      setNotice({ tone: "error", text: "提交请求失败，请检查网络后重试" });
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskLists(userId) });
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  const readiness = submitReadiness(state.slots);
  const busy = mutation.isPending;

  const onSubmit = () => {
    if (readiness.kind !== "ready" || busy || submitting.current) return;
    submitting.current = true;
    const combo = readiness.materialIds.join(",");
    // 素材组合一变就换新的 key；同一组合（包括网络重试）沿用原来的 key
    if (idempotency.current?.combo !== combo) idempotency.current = { combo, key: newIdempotencyKey() };
    setNotice(null);
    mutation.mutate({ materialIds: readiness.materialIds, key: idempotency.current.key });
  };

  const label = busy
    ? "提交中…"
    : readiness.kind === "missing"
      ? `还需上传 ${readiness.count} 张`
      : readiness.kind === "problem"
        ? "请先处理有问题的图片"
        : readiness.kind === "uploading"
          ? "等待上传完成…"
          : "立即制作";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {state.slots.map((slot, index) => (
          <UploadSlot
            key={index}
            index={index}
            state={slot}
            accept={template.acceptedMimeTypes.join(",")}
            disabled={busy}
            onSelect={(file) => startUpload(index, file)}
            onRemove={() => removeSlot(index)}
            onRetry={() => {
              if (slot.status === "error") startUpload(index, slot.file);
            }}
          />
        ))}
      </div>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={readiness.kind !== "ready"}
        loading={busy}
        icon={<Sparkles aria-hidden="true" className="size-4" />}
        onClick={onSubmit}
      >
        {label}
      </Button>
      <div aria-live="polite" className="min-h-5 text-sm">
        {notice ? <p className={notice.tone === "ok" ? "text-ok" : "text-bad"}>{notice.text}</p> : null}
      </div>
    </div>
  );
}
