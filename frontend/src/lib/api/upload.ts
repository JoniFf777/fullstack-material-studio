// 上传单独用 XHR：fetch 拿不到上传进度。
import { notifyUnauthorized } from "./client";
import { ApiError, toHttpError } from "./errors";
import type { MaterialDto } from "./types";
import { materialDto, parse } from "./validate";

export interface UploadHandle {
  promise: Promise<MaterialDto>;
  abort: () => void;
}

const active = new Set<XMLHttpRequest>();

/** 退出登录、切换账号时中止所有进行中的上传。 */
export function abortAllUploads(): void {
  for (const xhr of [...active]) xhr.abort();
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function uploadMaterial(file: File, templateId: string, onProgress?: (percent: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<MaterialDto>((resolve, reject) => {
    const settle = () => active.delete(xhr);
    xhr.open("POST", "/api/materials");
    xhr.responseType = "text";
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => {
      // 请求体发完不等于上传成功，所以收到响应前最多显示 99%
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      settle();
      const body = parseBody(xhr.responseText);
      if (xhr.status === 201) {
        try {
          onProgress?.(100);
          resolve(parse(materialDto, body));
        } catch (error) {
          reject(error);
        }
        return;
      }
      const error = toHttpError(xhr.status, body);
      if (xhr.status === 401 && error.code === "UNAUTHENTICATED") notifyUnauthorized();
      reject(error);
    };
    const networkFailure = () => {
      settle();
      reject(new ApiError({ kind: "network", message: "上传失败，请检查网络后重试" }));
    };
    xhr.onerror = networkFailure;
    xhr.ontimeout = networkFailure;
    xhr.onabort = () => {
      settle();
      reject(new DOMException("上传已取消", "AbortError"));
    };

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("templateId", templateId);
    active.add(xhr);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
