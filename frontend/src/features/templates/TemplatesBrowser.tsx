"use client";

import { useSearchParams } from "next/navigation";
import { CategoryNav } from "./CategoryNav";
import { TemplateGrid } from "./TemplateGrid";
import { useCategories, useTemplates } from "./useCatalog";

export function TemplatesBrowser() {
  const params = useSearchParams();
  const category = params.get("category") || null;
  const categories = useCategories();
  const templates = useTemplates(category);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">选择模板</h1>
        <p className="mt-1 text-sm text-muted">上传图片后提交，后台会依次完成素材检查、模拟生成和结果整理。</p>
      </div>
      <CategoryNav
        categories={categories.data}
        loading={categories.isPending}
        failed={categories.isError}
        onRetry={() => void categories.refetch()}
        active={category}
      />
      <TemplateGrid
        templates={templates.data}
        loading={templates.isPending}
        failed={templates.isError}
        onRetry={() => void templates.refetch()}
        filtered={category !== null}
      />
    </div>
  );
}
