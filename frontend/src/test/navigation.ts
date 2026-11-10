import { vi } from "vitest";

// next/navigation 的替身：测试里可以断言 router.replace 的调用
export const routerMock = {
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};

export const navigationState = {
  pathname: "/",
  searchParams: new URLSearchParams(),
};
