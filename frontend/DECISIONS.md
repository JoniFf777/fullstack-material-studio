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
- 响应校验用手写的小型守卫组合子（`lib/api/validate.ts`），没有引入 zod：只检查前端用到的字段和枚举，出错时抛 `ContractError` 并指出字段路径（例如 `$.status`）。
- 401 只有在 code 为 `UNAUTHENTICATED` 时才触发"会话失效"流程；登录失败的 401 `INVALID_CREDENTIALS` 只在表单里提示。
- X-User-Id 检查（P1）跳过账号接口（me / login / register / logout），避免切换账号时 me 自己触发重置循环。
- 测试读取 `../verify/fixtures`：jsdom 环境里 `import.meta.url` 不是 `file:` 地址，所以夹具目录在 `vitest.config.mts`（Node 环境）里算好，通过 `VERIFY_FIXTURE_DIR` 传给测试。

## 阶段验收

- F0：`npm run lint`、`npm run typecheck`、`npm run build` 通过，生成 `.next/standalone/server.js`。
- F1：`apiClient.test.ts`（10 项）和 `fixtures.test.ts`（15 项，13 个夹具全部通过前端校验）通过；lint、typecheck 通过。
- F2–F4：`uploadSlotsReducer.test.ts`、`validateFile.test.ts` 通过（共 35 项）。用开发服务器（:3000，转发到本机后端 :8080）在内置浏览器里核对：
  - 未登录访问 `/` 被 proxy 重定向到 `/login`；用 demo 登录后回到首页。
  - S01：5 个分类、8 个模板；"萌宠"2 个，地址栏为 `?category=pets`；"婚礼"显示空状态；`/templates/wedding-invite` 显示"模板不存在或已下线"；旅行明信片显示"需要 2 张 · JPG / PNG · 每张不超过 5MB"。
  - S02：页面内生成的 JPG 上传后"已就绪"；文本冒充的 .jpg 被服务端拒绝，上传位显示原因和重试按钮；换成 PNG 后按钮变为"立即制作"；提交返回 202，提示"已提交，任务 #64 已进入队列"，上传位清空；迷你头像选 300KB 文件、复古胶片选 PNG，都在前端直接提示，没有发出上传请求。
- 内置浏览器无法操作系统文件选择框，验证时在页面里用 canvas 生成图片，通过 DataTransfer 放进 `<input type="file">` 再触发 change 事件，后面的上传流程与真实选择文件相同。

## 问题记录

（暂无）
