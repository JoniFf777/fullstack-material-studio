"use client";

import { useSyncExternalStore } from "react";

// 全局共享一个 30 秒的时钟，用来刷新"3 分钟前"这类相对时间；没有订阅者时停表。
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const snapshot = () => now;

export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
