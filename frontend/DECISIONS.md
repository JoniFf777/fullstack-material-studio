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
- `package-lock.json` 里的下载地址统一改为 `registry.npmjs.org`。它最初在 npmmirror 源下生成，所有 `resolved` 都指向 npmmirror；npm 只会替换官方源的地址，结果 CI 和评审环境也会被迫从 npmmirror 下载。两个源的 tarball 路径和 integrity 完全相同，只换域名；本机配置了 npmmirror 时 npm 会自动把官方地址替换成配置的源（`replace-registry-host=npmjs`），`npm ci` 已验证。
- 前端 Dockerfile：deps / build / runtime 三阶段，基于 `node:24-alpine`；`BACKEND_INTERNAL_URL` 作为 build arg（rewrites 在构建时写进产物）；可选 build arg `NPM_REGISTRY`（默认空，用官方源），仓库里不写镜像地址；运行阶段只拷 standalone 产物和 `.next/static`，用 `node` 用户运行。`public/` 目录没有文件，所以不拷贝它。
- `/dev` 调试页（P1）不需要登录；开发接口关闭时后端对该路径返回 404，页面据此提示"开发接口没有打开"。
- 测试读取 `../verify/fixtures`：jsdom 环境里 `import.meta.url` 不是 `file:` 地址，所以夹具目录在 `vitest.config.mts`（Node 环境）里算好，通过 `VERIFY_FIXTURE_DIR` 传给测试。

## 阶段验收

- F0：`npm run lint`、`npm run typecheck`、`npm run build` 通过，生成 `.next/standalone/server.js`。
- F1：`apiClient.test.ts`（10 项）和 `fixtures.test.ts`（15 项，13 个夹具全部通过前端校验）通过；lint、typecheck 通过。
- F2–F4：`uploadSlotsReducer.test.ts`、`validateFile.test.ts` 通过（共 35 项）。用开发服务器（:3000，转发到本机后端 :8080）在内置浏览器里核对：
  - 未登录访问 `/` 被 proxy 重定向到 `/login`；用 demo 登录后回到首页。
  - S01：5 个分类、8 个模板；"萌宠"2 个，地址栏为 `?category=pets`；"婚礼"显示空状态；`/templates/wedding-invite` 显示"模板不存在或已下线"；旅行明信片显示"需要 2 张 · JPG / PNG · 每张不超过 5MB"。
  - S02：页面内生成的 JPG 上传后"已就绪"；文本冒充的 .jpg 被服务端拒绝，上传位显示原因和重试按钮；换成 PNG 后按钮变为"立即制作"；提交返回 202，提示"已提交，任务 #64 已进入队列"，上传位清空；迷你头像选 300KB 文件、复古胶片选 PNG，都在前端直接提示，没有发出上传请求。
- F5（测试先行）：先写 `taskView`、`mergeTask`、`taskTracking` 的测试，用只抛"尚未实现"的空壳确认失败（mergeTask 6 个、taskView 9 个失败，taskTracking 因缺少 HistoryPanel 无法加载）；实现后 20 项全部通过。`createPanel` 的 3 项测试写在 CreatePanel（F4）之后，首次运行即通过。全部 58 项测试、lint、typecheck 通过。S03–S10 的浏览器核对尚未完成。
- F6：补 `authReset.test.tsx`（P1，2 项）：退出登录时中止进行中的请求、清空 `['u', …]` 缓存、旧任务卡片立即消失并去登录页；会话中途失效（401 UNAUTHENTICATED）走同样的流程。全部 60 项测试通过。
- 内置浏览器无法操作系统文件选择框，验证时在页面里用 canvas 生成图片，通过 DataTransfer 放进 `<input type="file">` 再触发 change 事件，后面的上传流程与真实选择文件相同。

## 问题记录

- 人工清单 S09 第 3 步（2026-11-11）：浏览器离线（开发者工具切到 Offline）时，处理中的卡片一直停在"处理中 · 模拟生成"，没有"状态更新失败"的提示；联网后才突然更新。spec/05 §8.2 要求离线和其他请求异常一样提示。根因：TanStack Query 默认的 networkMode 是 "online"，浏览器报告离线后查询被暂停（fetchStatus 为 paused），不会进入 error，卡片也就拿不到查询异常。先在 `taskTracking.test.tsx` 补用例 ⑥（`onlineManager.setOnline(false)` 后下一次轮询的请求失败），确认修复前找不到提示而失败；再给 `useTrackedTask` 设 `networkMode: "always"`。补完后用例仍然失败：联网后没有自动重新查询。原因是 networkMode 为 "always" 时，TanStack Query 把 refetchOnReconnect 的默认值改成 false，所以显式设为 true。全部 61 项测试、lint、typecheck 通过；重建镜像后在浏览器里用同样的方式复测通过。
