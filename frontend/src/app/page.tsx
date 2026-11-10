import { Suspense } from "react";
import { TemplatesBrowser } from "@/features/templates/TemplatesBrowser";

export default function HomePage() {
  // TemplatesBrowser 用 useSearchParams 读取当前分类，必须包在 Suspense 里
  return (
    <Suspense fallback={null}>
      <TemplatesBrowser />
    </Suspense>
  );
}
