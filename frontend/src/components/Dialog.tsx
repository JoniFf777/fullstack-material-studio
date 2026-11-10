"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * 原生 <dialog> + showModal()：自带焦点限制和 Esc 关闭，关闭后浏览器把焦点还给打开它的按钮。
 */
export function Dialog({ open, onClose, title, children, className = "" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto w-[min(92vw,32rem)] rounded-2xl border border-line bg-panel p-0 text-ink shadow-2xl ${className}`}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-zinc-800 hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{open ? children : null}</div>
    </dialog>
  );
}
