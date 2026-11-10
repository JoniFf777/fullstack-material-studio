import type { Metadata } from "next";
import { HistoryView } from "@/features/tasks/HistoryView";

export const metadata: Metadata = { title: "我的作品" };

export default function HistoryPage() {
  return <HistoryView />;
}
