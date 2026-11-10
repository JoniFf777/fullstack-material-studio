import Link from "next/link";
import { StatePlaceholder } from "@/components/StatePlaceholder";

export default function NotFound() {
  return (
    <StatePlaceholder
      kind="empty"
      title="页面不存在"
      description="地址可能写错了，或者页面已经移走。"
      action={
        <Link href="/" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-ink">
          回到模板列表
        </Link>
      }
      className="mx-auto mt-16 max-w-lg"
    />
  );
}
