import type { NextConfig } from "next";

// 浏览器只访问 Next（:3000）；/api 和 /demo 由这里转发给 Java 后端。
// 转发地址在构建时写进产物，所以 Docker 构建时要通过 build arg BACKEND_INTERNAL_URL 传入。
const backend = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8080").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // 素材和结果图要由浏览器带着 Cookie 直接请求；图片优化器在服务端取图，拿不到 Cookie
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/demo/:path*", destination: `${backend}/demo/:path*` },
    ];
  },
};

export default nextConfig;
