"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountDialog } from "@/features/auth/AccountDialog";
import { useAuth } from "@/features/auth/AuthProvider";
import { Avatar } from "./Avatar";

function NavLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? "bg-card text-ink" : "text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}

export function AppHeader() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <Sparkles aria-hidden="true" className="size-5 text-brand" />
          素材工坊
        </Link>
        {user ? (
          <nav aria-label="主导航" className="flex items-center gap-1">
            <NavLink href="/" active={pathname === "/" || pathname.startsWith("/templates")}>
              模板
            </NavLink>
            <NavLink href="/history" active={pathname.startsWith("/history")}>
              我的作品
            </NavLink>
          </nav>
        ) : null}
        {user ? (
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-haspopup="dialog"
            aria-label={`账号：${user.displayName}`}
            className="ml-auto flex items-center gap-2 rounded-full py-1 pl-1 pr-1 text-sm hover:bg-card sm:pr-3"
          >
            <Avatar name={user.displayName} className="size-8 text-sm" />
            <span className="hidden max-w-32 truncate sm:inline">{user.displayName}</span>
          </button>
        ) : null}
      </div>
      {user ? <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} user={user} /> : null}
    </header>
  );
}
