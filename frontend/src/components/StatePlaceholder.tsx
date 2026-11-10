import type { ReactNode } from "react";

interface StatePlaceholderProps {
  kind: "empty" | "error";
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** 空数据和出错时的占位。出错用 role="alert"，屏幕阅读器会立即读出。 */
export function StatePlaceholder({ kind, title, description, action, className = "" }: StatePlaceholderProps) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center ${className}`}
    >
      <p className={`text-base font-medium ${kind === "error" ? "text-bad" : "text-ink"}`}>{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
