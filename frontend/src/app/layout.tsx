import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "素材工坊", template: "%s · 素材工坊" },
  description: "选择模板、上传图片，后台异步生成素材作品",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
