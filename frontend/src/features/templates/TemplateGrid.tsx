import Link from "next/link";
import { Button } from "@/components/Button";
import { StatePlaceholder } from "@/components/StatePlaceholder";
import type { TemplateSummaryDto } from "@/lib/api/types";
import { TemplateCard } from "./TemplateCard";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6";

interface TemplateGridProps {
  templates: TemplateSummaryDto[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  filtered: boolean;
}

export function TemplateGrid({ templates, loading, failed, onRetry, filtered }: TemplateGridProps) {
  if (loading) {
    return (
      <div role="status" aria-label="模板加载中" className={GRID}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-3/4 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }
  if (failed) {
    return <StatePlaceholder kind="error" title="模板加载失败" description="网络或服务暂时不可用" action={<Button onClick={onRetry}>重试</Button>} />;
  }
  if (!templates || templates.length === 0) {
    return (
      <StatePlaceholder
        kind="empty"
        title={filtered ? "这个分类还没有模板" : "还没有可用的模板"}
        action={
          filtered ? (
            <Link href="/" className="text-sm text-brand underline underline-offset-4">
              查看全部模板
            </Link>
          ) : undefined
        }
      />
    );
  }
  return (
    <ul className={GRID}>
      {templates.map((template) => (
        <li key={template.id}>
          <TemplateCard template={template} />
        </li>
      ))}
    </ul>
  );
}
