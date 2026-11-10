# frontend

素材制作网站的前端：Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4 + TanStack Query 5。

浏览器只访问 Next（默认 http://localhost:3000），`/api/*` 和 `/demo/*` 由 Next 转发给 Java 后端（`BACKEND_INTERNAL_URL`，默认 http://localhost:8080，构建时确定）。

```bash
npm ci
npm run dev        # 开发服务器，需要后端在 8080 运行
npm run lint
npm run typecheck  # 先 next typegen 生成路由类型，再 tsc
npm test           # Vitest，测试里的假响应来自 ../verify/fixtures
npm run build
```

设计说明见 `../spec/05-frontend.md`，实现中的决定见 `DECISIONS.md`，整体说明见仓库根目录的 README。
