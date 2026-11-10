import Link from "next/link";
import type { CategoryDto } from "@/lib/api/types";

interface CategoryNavProps {
  categories: CategoryDto[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  active: string | null;
}

function pillClass(active: boolean): string {
  return `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-colors ${
    active ? "bg-ink font-medium text-page" : "bg-card text-muted hover:bg-zinc-800 hover:text-ink"
  }`;
}

/** 分类是一组链接，当前分类写在 URL（?category=）里：支持前进、后退，刷新后也保留。 */
export function CategoryNav({ categories, loading, failed, onRetry, active }: CategoryNavProps) {
  const total = categories?.reduce((sum, c) => sum + c.templateCount, 0);
  return (
    <nav aria-label="模板分类" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 pb-1">
        <li>
          <Link href="/" aria-current={active === null ? "page" : undefined} className={pillClass(active === null)}>
            全部
            {total !== undefined ? <span className="text-xs opacity-70">{total}</span> : null}
          </Link>
        </li>
        {categories?.map((category) => (
          <li key={category.code}>
            <Link
              href={`/?category=${encodeURIComponent(category.code)}`}
              aria-current={active === category.code ? "page" : undefined}
              className={pillClass(active === category.code)}
            >
              {category.name}
              <span className="text-xs opacity-70">{category.templateCount}</span>
            </Link>
          </li>
        ))}
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={`loading-${i}`} aria-hidden="true">
                <span className="inline-block h-9 w-20 animate-pulse rounded-full bg-card" />
              </li>
            ))
          : null}
        {failed ? (
          <li className="flex items-center gap-2 text-sm text-bad">
            分类加载失败
            <button type="button" onClick={onRetry} className="rounded-lg px-2 py-1 text-ink underline underline-offset-4">
              重试
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
