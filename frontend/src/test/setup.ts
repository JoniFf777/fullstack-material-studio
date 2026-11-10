import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { navigationState, routerMock } from "./navigation";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.values(routerMock).forEach((fn) => fn.mockReset());
  navigationState.pathname = "/";
  navigationState.searchParams = new URLSearchParams();
});

// ── Next 的替身：测试里没有 App Router，也不需要图片优化 ──

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams,
}));

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: function MockImage(props: Record<string, unknown>) {
      const { fill: _fill, sizes: _sizes, priority: _priority, unoptimized: _unoptimized, ...rest } = props;
      void _fill;
      void _sizes;
      void _priority;
      void _unoptimized;
      return React.createElement("img", rest);
    },
  };
});

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: function MockLink(props: Record<string, unknown>) {
      const { href, children, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...rest } = props;
      void _prefetch;
      void _replace;
      void _scroll;
      return React.createElement("a", { href: typeof href === "string" ? href : String((href as { pathname?: string })?.pathname ?? ""), ...rest }, children as never);
    },
  };
});

// ── jsdom 没有实现的浏览器能力 ──

if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}

if (typeof URL.createObjectURL !== "function") {
  let next = 0;
  URL.createObjectURL = () => `blob:test/${(next += 1)}`;
  URL.revokeObjectURL = () => {};
}
