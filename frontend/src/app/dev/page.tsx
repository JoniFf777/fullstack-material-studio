import type { Metadata } from "next";
import { SimulationPanel } from "@/features/dev/SimulationPanel";

export const metadata: Metadata = { title: "模拟调试" };

export default function DevPage() {
  return <SimulationPanel />;
}
