import Image from "next/image";
import Link from "next/link";
import type { TemplateSummaryDto } from "@/lib/api/types";

export function TemplateCard({ template }: { template: TemplateSummaryDto }) {
  return (
    <Link
      href={`/templates/${encodeURIComponent(template.id)}`}
      // 封面 alt 和可见标题相同，用 aria-label 给链接一个不重复的名字
      aria-label={`${template.title}，需要 ${template.requiredImageCount} 张图`}
      className="group relative block aspect-3/4 overflow-hidden rounded-2xl bg-card ring-1 ring-line transition hover:ring-zinc-500"
    >
      <Image
        src={template.coverUrl}
        alt={template.title}
        fill
        sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-10">
        <p className="truncate text-sm font-semibold text-white">{template.title}</p>
        <p className="mt-0.5 text-xs text-zinc-300">需要 {template.requiredImageCount} 张图</p>
      </div>
    </Link>
  );
}
