import type { Metadata } from "next";
import { TemplateWorkspace } from "@/features/create/TemplateWorkspace";

export const metadata: Metadata = { title: "模板详情" };

export default async function TemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  return <TemplateWorkspace id={id} />;
}
