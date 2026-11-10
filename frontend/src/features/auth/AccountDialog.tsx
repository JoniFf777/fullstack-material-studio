"use client";

import { LogOut, Repeat } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import type { UserDto } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "./AuthProvider";

export function AccountDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: UserDto }) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState<"switch" | "logout" | null>(null);

  const run = async (kind: "switch" | "logout") => {
    setBusy(kind);
    try {
      // "切换账号"和"退出登录"都会删除当前会话、清空缓存，然后回到登录页
      await logout();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="账号">
      <div className="flex items-center gap-4">
        <Avatar name={user.displayName} className="size-14 text-xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{user.displayName}</p>
          <p className="truncate text-sm text-muted">@{user.username}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl bg-card px-4 py-3 text-sm">
        <dt className="text-muted">用户 ID</dt>
        <dd>{user.id}</dd>
        <dt className="text-muted">注册时间</dt>
        <dd>{formatDateTime(user.createdAt)}</dd>
      </dl>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button icon={<Repeat aria-hidden="true" className="size-4" />} loading={busy === "switch"} disabled={busy !== null} onClick={() => void run("switch")}>
          切换账号
        </Button>
        <Button variant="danger" icon={<LogOut aria-hidden="true" className="size-4" />} loading={busy === "logout"} disabled={busy !== null} onClick={() => void run("logout")}>
          退出登录
        </Button>
      </div>
    </Dialog>
  );
}
