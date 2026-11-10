# 前端实现记录

## 实现决定

- 用 `create-next-app@16.4.6` 生成骨架（TypeScript、ESLint、Tailwind、App Router、`src/`、别名 `@/*`），实际版本：Next 16.4.6、React 19.3.0、TypeScript 5.9.3、ESLint 9.39、Tailwind CSS 4.3.3。
- 关闭了模板默认打开的 `cacheComponents` 和 `partialPrefetching`。开启后，客户端切换路由时旧页面不卸载，只是隐藏（React `<Activity>`），组件状态和请求逻辑都会保留；而本项目的轮询停止、上传中止都是按"离开页面就卸载"设计的（spec/05 §8.2）。数据全部在客户端用 TanStack Query 获取，用不到 Cache Components 的服务端缓存。
- 不使用 `next/font/google`。模板默认在构建时从 Google Fonts 下载字体，国内网络和评审的隔离环境都可能访问不到，会导致构建失败。改用系统字体栈（PingFang SC / Microsoft YaHei 等）。
- `typecheck` 脚本是 `next typegen && tsc --noEmit`：`next-env.d.ts` 和 `.next/types` 都不进仓库，CI 里要先生成，`LayoutProps`、`PageProps` 这些全局类型才可用（Next 文档推荐的做法）。
- Tailwind 通过模板给出的 `@tailwindcss/turbopack` 加载器接入，没有 PostCSS 配置。如果以后改用 `next build --webpack`，需要补 PostCSS 配置。
- 在 `eslint-config-next` 之外，打开了 `eslint-plugin-jsx-a11y` 的推荐规则（R-11）。
- 保留 `AGENTS.md`：`next dev` 会自动重新生成它，提交进仓库能保持工作区干净。
- Vitest 5 把 vite 声明为 peer 依赖，所以显式安装了 vite 8；路径别名直接写在 `vitest.config.mts` 里，没有引入额外插件。
- Next 的匿名遥测：Dockerfile 和 CI 里设置 `NEXT_TELEMETRY_DISABLED=1`，不修改开发机的全局配置。

## 阶段验收

- F0：`npm run lint`、`npm run typecheck`、`npm run build` 通过，生成 `.next/standalone/server.js`。

## 问题记录

（暂无）
