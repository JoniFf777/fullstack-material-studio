"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { loginPath, useAuth } from "@/features/auth/AuthProvider";
import { AppHeader } from "./AppHeader";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { StatePlaceholder } from "./StatePlaceholder";

const PUBLIC_PATHS = ["/login", "/dev"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 已登录才渲染页面内容；未登录时立即卸载页面（不闪现旧数据）并跳到登录页。 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status, retry } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace(loginPath(`${window.location.pathname}${window.location.search}`));
  }, [status, router]);

  if (status === "authenticated") return children;
  if (status === "error") {
    return (
      <StatePlaceholder
        kind="error"
        title="暂时无法确认登录状态"
        description="网络或服务暂时不可用，请稍后重试"
        action={<Button onClick={retry}>重试</Button>}
        className="mx-auto mt-16 max-w-lg"
      />
    );
  }
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
      <Spinner />
      正在加载…
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const open = isPublic(pathname);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-ink">
        跳到主要内容
      </a>
      {pathname === "/login" ? null : <AppHeader />}
      <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4 sm:px-6">
        {open ? children : <RequireAuth>{children}</RequireAuth>}
      </main>
    </>
  );
}
