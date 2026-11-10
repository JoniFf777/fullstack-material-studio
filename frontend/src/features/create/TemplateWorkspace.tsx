"use client";

import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/Button";
import { StatePlaceholder } from "@/components/StatePlaceholder";
import { HistoryPanel } from "@/features/tasks/HistoryPanel";
import { useTemplate } from "@/features/templates/useCatalog";
import { errorCode, errorMessage } from "@/lib/api/errors";
import type { TemplateDetailDto } from "@/lib/api/types";
import { acceptedTypesLabel, formatBytes } from "@/lib/format";
import { CreatePanel } from "./CreatePanel";

function Cover({ template }: { template: TemplateDetailDto }) {
  return (
    <div className="relative h-56 overflow-hidden rounded-xl bg-card sm:h-64">
      {/* 模糊背景上居中显示原图（UI-02） */}
      <Image src={template.coverUrl} alt="" aria-hidden="true" fill sizes="380px" className="scale-110 object-cover opacity-50 blur-xl" />
      <Image src={template.coverUrl} alt={template.title} fill sizes="380px" className="object-contain p-3" />
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="模板加载中" className="max-w-[380px] space-y-4 rounded-2xl border border-line bg-panel p-5">
      <div className="h-6 w-40 animate-pulse rounded bg-card" />
      <div className="h-56 animate-pulse rounded-xl bg-card" />
      <div className="h-4 w-full animate-pulse rounded bg-card" />
      <div className="grid grid-cols-2 gap-3">
        <div className="aspect-square animate-pulse rounded-xl bg-card" />
        <div className="aspect-square animate-pulse rounded-xl bg-card" />
      </div>
    </div>
  );
}

export function TemplateWorkspace({ id }: { id: string }) {
  const query = useTemplate(id);

  if (query.isPending) return <Skeleton />;
  if (query.isError) {
    if (errorCode(query.error) === "TEMPLATE_NOT_FOUND") {
      return (
        <StatePlaceholder
          kind="empty"
          title="模板不存在或已下线"
          action={
            <Link href="/" className="text-sm text-brand underline underline-offset-4">
              返回模板列表
            </Link>
          }
          className="mx-auto mt-10 max-w-lg"
        />
      );
    }
    return (
      <StatePlaceholder
        kind="error"
        title="模板加载失败"
        description={errorMessage(query.error)}
        action={<Button onClick={() => void query.refetch()}>重试</Button>}
        className="mx-auto mt-10 max-w-lg"
      />
    );
  }

  const template = query.data;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section aria-labelledby="template-title" className="space-y-4 rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="返回模板列表" className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-zinc-800 hover:text-ink">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <h1 id="template-title" className="truncate text-lg font-semibold">
            {template.title}
          </h1>
        </div>
        <Cover template={template} />
        <p className="text-sm text-muted">{template.description}</p>
        <p className="rounded-lg bg-card px-3 py-2 text-xs text-muted">
          需要 {template.requiredImageCount} 张 · {acceptedTypesLabel(template.acceptedMimeTypes)} · 每张不超过 {formatBytes(template.maxFileSizeBytes)}
        </p>
        <CreatePanel key={template.id} template={template} />
      </section>
      <HistoryPanel templateId={template.id} />
    </div>
  );
}
