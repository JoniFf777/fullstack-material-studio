# 05 前端设计

> 本文件只是设计。前端代码等你确认规格、I0 的验证资产就位之后才开始写（见 07 §1）。

## 1. 页面与路由

| 路由 | 页面 | 需要登录 | 对应截图 |
|---|---|---|---|
| `/` | 模板列表：分类导航 + 卡片网格；当前分类写在 `?category=` 里 | 是 | UI-01 |
| `/templates/[id]` | 模板详情与制作：左栏放信息、上传位、提交按钮；右栏放该模板的历史 | 是 | UI-02、UI-03 |
| `/history` | 我的作品：全部任务，可按状态筛选 | 是 | — |
| `/login` | 登录 / 注册两个 tab，页面上显示演示账号 | 否 | — |
| `/dev` | 模拟调试面板（P1）。导航里不显示，README 里给地址 | 否 | — |

除登录页外，页面默认都需要登录：

- `src/proxy.ts`（Next 16 里 middleware 改名为 proxy）检查请求里有没有 `XY_SESSION` Cookie，没有就重定向到 `/login?next=原路径`。
- Cookie 是否有效以后端为准：任何请求收到 401，都走"会话失效"流程（§5）。

## 2. 视觉与布局

色板在 Tailwind 4 的 `@theme` 里定义：

| 用途 | 色值 |
|---|---|
| 页面背景 | `#0b0b0e` |
| 面板 | `#141418` |
| 卡片 | `#1c1c22` |
| 边框 | `#2a2a32` |
| 正文 / 次要文字 | `#f4f4f5` / `#a1a1aa` |
| 主色（按钮） | `#a3e635`，按钮文字 `#111` |
| 成功 / 警告 / 失败 | `#4ade80` / `#fbbf24` / `#f87171` |

圆角 12–16px，卡片为 3:4 的竖版。

和参考截图的对应关系：

| 截图 | 对应 | 保留 | 不做 |
|---|---|---|---|
| UI-01 列表 | `/` | 顶栏（左边 logo，右边用户按钮）；分类胶囊；竖版卡片，底部渐变上压标题 | 一级频道（Video / workflow）、English、credits |
| UI-02 详情 | `/templates/[id]` | 左栏：返回按钮和标题；封面（模糊背景上居中显示原图）；素材要求说明；上传位；底部主按钮。右栏：History 标题、刷新图标按钮、任务卡片网格 | 按钮上的积分 |
| UI-03 制作中 | 同上 | 新任务卡片出现在最前面；处理中的卡片显示当前阶段；失败的卡片显示原因 | 卡片上的删除按钮 |
| UI-04 账号 | 账号弹窗 | 头像（显示名首字）、显示名、用户名、用户 ID、注册时间、切换账号、退出登录 | Billing、条款、删除账号、重置密码 |

响应式：

- 列表网格：小于 640px 时 2 列，往上依次 3 列、4 列，≥1280px 时 6 列。
- 详情：≥1024px 时左右两栏，左栏宽 380px；更窄时上下堆叠，上传位占满宽度。
- 历史网格：2 / 3 / 4 列。
- 375px 宽度下所有操作都可用，没有横向滚动。

## 3. 目录结构

```
frontend/src/
├─ app/
│  ├─ layout.tsx               全局布局：Providers + AppHeader
│  ├─ providers.tsx            QueryClientProvider + AuthProvider
│  ├─ page.tsx                 模板列表
│  ├─ templates/[id]/page.tsx  详情与制作
│  ├─ history/page.tsx         我的作品
│  ├─ login/page.tsx           登录 / 注册
│  ├─ dev/page.tsx             调试面板（P1）
│  └─ not-found.tsx、error.tsx、globals.css
├─ proxy.ts                    未登录时重定向
├─ lib/
│  ├─ api/types.ts             03 §2 的类型
│  ├─ api/validate.ts          响应的运行时校验（契约守卫）
│  ├─ api/client.ts            fetch 封装、错误分类、401 处理
│  ├─ api/endpoints.ts         各个接口函数
│  ├─ api/upload.ts            XHR 上传（进度、中止）
│  ├─ query-keys.ts
│  └─ format.ts                时间、文件大小、中文显示名
├─ features/
│  ├─ auth/                    AuthProvider、LoginForm、RegisterForm、AccountDialog
│  ├─ templates/               CategoryNav、TemplateGrid、TemplateCard
│  ├─ create/                  CreatePanel、UploadSlot、uploadSlotsReducer、validateFile
│  └─ tasks/                   HistoryPanel、TaskCard、StageSteps、ResultPreviewDialog、
│                              useTaskList、useTrackedTask、taskView、mergeTask
├─ components/                 Button、StatePlaceholder（加载 / 空 / 错误）、Dialog、Spinner
└─ test/                       setup.ts、fakeApi.ts、fixtures.ts（读取 verify/fixtures）
```

## 4. 数据层

### 4.1 API 客户端（`lib/api/client.ts`）

所有请求都走 `apiFetch<T>(path, { method, json, signal })`：

| 情况 | 处理 |
|---|---|
| 2xx | 解析 JSON（204 返回 undefined） |
| 非 2xx | 解析错误体，抛出 `ApiError { kind: 'http', status, code, message, fieldErrors }` |
| fetch 本身抛错（断网、连接被拒等） | 抛出 `ApiError { kind: 'network' }` |
| AbortError | 原样抛出，TanStack Query 会把它当作取消，而不是错误 |
| 401 | 先调用全局的 `onUnauthorized()`（§5），再抛错 |
| 响应头 `X-User-Id` 与当前登录用户不一致 | 抛出 `SessionChangedError`，触发 §5 的重置（P1） |

另外：

- **响应校验**：`endpoints.ts` 拿到响应后，先用 `validate.ts` 做运行时校验（必需字段、枚举值），不合法就抛 `ContractError`，让前后端不一致尽早暴露。具体用手写守卫还是 zod，在 F1 决定。
- **上传**：单独用 XHR（`lib/api/upload.ts`），因为 fetch 拿不到上传进度。支持 `onProgress` 和 `abort()`。

### 4.2 QueryClient 默认值

- `staleTime`：模板和分类 5 分钟；任务 0。
- `retry`：4xx 不重试；网络错误和 5xx 重试 1 次。
- `refetchOnWindowFocus: true`、`refetchOnReconnect: true`。

### 4.3 Query key

| key | 数据 |
|---|---|
| `['me']` | 当前用户 |
| `['categories']` | 分类 |
| `['templates', category ?? 'all']` | 模板列表 |
| `['template', id]` | 模板详情 |
| `['u', userId, 'tasks', templateId ?? 'all']` | 某个用户的任务列表 |
| `['u', userId, 'task', taskId]` | 某个用户的单个任务 |

和用户相关的 key 都以 `['u', userId]` 开头，切换用户后，新旧用户的数据在缓存里天然是分开的。

## 5. 身份

- **`AuthProvider`**：启动时查询 `['me']`，对外提供 `user`、`login`、`register`、`logout`。
- **登录 / 注册成功**：先 `queryClient.clear()`，再写入 me，然后跳转到 `next` 参数指定的页面或 `/`。
- **退出、切换账号、收到 401**，按顺序执行：
  1. `queryClient.cancelQueries()`，中止所有进行中的请求
  2. `queryClient.clear()`，清掉旧用户的全部缓存
  3. 中止所有上传用的 XHR（上传位卸载时会自动完成）
  4. `router.replace('/login')`
- **跨标签页（P1）**：登录、退出时通过 `BroadcastChannel('xy-auth')` 广播。其他标签页收到后执行同样的重置，再重新查询 me。
- **账号弹窗**（`AccountDialog`，原生 `<dialog>`）：
  - 显示头像（显示名首字）、显示名、`@用户名`、用户 ID、注册时间。
  - 两个按钮："切换账号"（退出后到登录页）和"退出登录"。

## 6. 模板列表

- **数据**：`['categories']` 和 `['templates', category]`。
- **分类导航**：
  - 放在 `<nav aria-label="模板分类">` 里，是一组链接，"全部"在最前；当前项带 `aria-current="page"`，并显示 templateCount。
  - 切换分类会修改 URL（`?category=pets`），所以支持前进、后退，刷新后也能保留。
- **状态**：
  - 加载中：骨架卡片
  - 空分类：显示"这个分类还没有模板"，附"查看全部"链接
  - 失败：显示"模板加载失败"，附重试按钮（refetch）
- **卡片**：用 `<Link>` 包裹；封面 `<img alt={title}>`；底部渐变上显示标题和"需要 N 张图"。

## 7. 详情与上传

### 7.1 详情页的状态

| 情况 | 界面 |
|---|---|
| 加载中 | 左栏骨架 |
| 404 `TEMPLATE_NOT_FOUND` | "模板不存在或已下线"，附返回列表的链接 |
| 其他错误 | "模板加载失败"，附重试按钮 |
| 成功 | 标题、描述、封面、素材要求（例如"需要 2 张 · JPG / PNG · 每张不超过 5MB"）、上传位、提交按钮 |

### 7.2 上传位状态机（`uploadSlotsReducer`）

每个上传位的状态互相独立：

| 状态 | 什么时候进入 | 显示 | 可做的操作 |
|---|---|---|---|
| `empty` | 初始状态；移除之后 | 虚线框，写着"点击上传第 N 张" | 选择 |
| `invalid` | 前端校验没通过 | 原因（类型或大小），不发请求 | 重新选择 |
| `uploading` | 校验通过，XHR 进行中 | 本地预览、进度条、"上传中 42%" | 替换、移除（都会中止上传） |
| `ready` | 后端返回 201 | 预览 + ✓ | 替换、移除 |
| `error` | 上传失败（网络、4xx、5xx） | 预览 + 原因 | 重试、替换、移除 |

防止旧请求覆盖新结果：

- 每次上传分配一个递增的 `uploadId`，记在上传位上。进度、成功、失败事件都带着 uploadId；和上传位当前的 uploadId 不一致的事件直接丢弃。
- 替换、移除、组件卸载时，调用 `xhr.abort()`。
- 本地预览用 `URL.createObjectURL` 生成；替换、移除、卸载时调用 `revokeObjectURL` 释放。

前端校验（`validateFile`）检查两点：类型在 `acceptedMimeTypes` 里（看 `file.type`），大小不超过 `maxFileSizeBytes`。真实类型由服务端按文件头判断，所以 `not-image.jpg` 会通过前端校验、被后端拒绝——这正好是要演示的效果。

### 7.3 提交按钮

| 条件 | 文案 | 可点 |
|---|---|---|
| 素材没齐 | 还需上传 N 张 | 否 |
| 有正在上传的 | 等待上传完成… | 否 |
| 有失败或校验没通过的 | 请先处理有问题的图片 | 否 |
| 全部就绪 | 立即制作 | 是 |
| 请求进行中 | 提交中…（带 spinner） | 否 |

- 提交用 `useMutation`，请求头带 `Idempotency-Key`。素材组合一变就重新生成 key；网络重试时沿用原来的 key。
- **收到 202**：
  - 清空上传位。
  - 把返回的任务插到任务列表缓存的最前面。
  - 按钮立刻变回"还需上传 N 张"。
  - 按钮下方短暂提示"已提交，任务 #123 已进入队列"。
- **收到 4xx**：按钮下方显示 message，保留上传位。
- **网络错误**：
  - 提示"提交请求失败，请检查网络后重试"。
  - 保留上传位和 Idempotency-Key，这样重试不会重复建任务。
  - 刷新一次任务列表：如果任务其实已经建好了，用户也能看到。

## 8. 任务跟踪（重点）

### 8.1 数据流

- **列表**：`useTaskList(templateId?)` 使用 key `['u', uid, 'tasks', templateId ?? 'all']`。
  - 挂载时拉取一次，不轮询。
  - 之后靠刷新按钮、窗口重新聚焦、提交成功来更新。
- **单个任务**：每张卡片调用 `useTrackedTask(task)`，使用 key `['u', uid, 'task', id]`，以列表里的数据作为 initialData。
- **写回列表**：任务到达终态时，把最新数据写回所有任务列表的缓存（`setQueriesData({ queryKey: ['u', uid, 'tasks'] })`），保证列表和卡片一致。

### 8.2 轮询规则

| 规则 | 实现方式 |
|---|---|
| 只跟踪未完成的任务 | `enabled: !isTerminal(task.status)` |
| 轮询间隔 | 1500ms；`refetchIntervalInBackground: false`，标签页隐藏时暂停 |
| 任务结束就停 | `refetchInterval` 回调：数据是终态时返回 false |
| 没有未完成任务就不发请求 | 由上面两条自然满足 |
| 离开页面 | 卡片卸载后查询没有观察者，轮询停止；queryFn 使用了 signal，进行中的请求会被取消 |
| 请求异常 | 网络错误和 5xx 自动重试 1 次。仍然失败时：<br>1. 暂停这个任务的轮询（error 状态下 `refetchInterval` 返回 false）<br>2. 卡片显示"状态更新失败，任务仍在后台处理"和"重新查询"按钮<br>3. 点击按钮会 refetch，成功后自动恢复轮询<br>窗口重新聚焦、网络恢复时也会自动重试 |
| 刷新恢复 | 页面加载时拉取列表，列表里未完成的任务自动开始跟踪 |

### 8.3 终态不回退（`mergeTask`）

新数据写入缓存之前，先和旧数据合并：

- 旧数据是终态、新数据不是：保留旧数据。
- 新数据的 `updatedAt` 早于旧数据：保留旧数据（用 `Date.parse` 比较，不做字符串比较）。
- 其他情况：使用新数据。

可以通过 `structuralSharing` 实现，也可以在所有写缓存的地方统一调用。列表数据和单个任务数据合并时也走这个函数。

### 8.4 卡片视图模型（`deriveTaskView`，纯函数，有单元测试覆盖）

输入是任务数据和查询状态（是否出错、错误类型），输出如下：

| 情况 | 主文案 | 附加信息 |
|---|---|---|
| PENDING | 等待处理 | "排队中" |
| PROCESSING | 处理中 · {当前阶段} | 三段步骤条，当前段带动画 |
| SUCCEEDED | 已完成 | 结果缩略图，点击打开预览 |
| FAILED | 失败 · {失败阶段} | errorMessage；步骤条里失败的那段标红，之后的段为灰色 |
| 任何非终态 + 查询出错 | **保持上面的主文案不变** | 额外显示黄色提示条："状态更新失败，任务仍在后台处理"，附"重新查询"按钮 |
| 查询返回 404 | 任务不存在 | — |

查询出错时，界面上绝不能出现"失败"字样，单元测试会对此做断言（06 §5.3）。

### 8.5 卡片内容

- 背景：成功时是结果图；其他状态是模板封面，加一层暗色遮罩。
- 顶部：模板名（在 `/history` 显示）和创建时间（相对时间，悬停显示绝对时间）。
- 中间：主文案，所在区域设 `aria-live="polite"`。
- 底部：步骤条（素材检查 / 模拟生成 / 结果整理）。
- 失败时：显示原因文字。

## 9. 历史页与结果预览

- **`/history`**：
  - 显示全部任务。
  - 顶部有筛选：全部 / 进行中 / 已完成 / 失败（在前端过滤）。
  - 没有任务时显示"还没有作品，去挑个模板"。
- **预览弹窗**（`ResultPreviewDialog`）：显示大图、模板名、创建和完成时间、三步各自的耗时；关闭后焦点回到原来的卡片上。

## 10. 调试页 `/dev`（P1）

表单包含：

- 失败阶段（单选：无，或三个阶段之一）
- 三步各自的耗时输入框
- "查询接口故障"开关
- 保存（PATCH）和恢复默认（reset）两个按钮

页面顶部注明"仅用于演示，生产环境请关闭"。

## 11. 无障碍清单

- 可点击的元素都用 `<button>` 或 `<a>`，所有按钮都写明 `type`。
- 图标按钮都有 `aria-label`，例如：刷新历史记录、移除第 N 张图片、替换第 N 张图片、关闭、重新查询任务 #id。
- 文件输入框视觉上隐藏但可以聚焦（用 `sr-only`，不用 `display:none`），通过 `<label>` 关联。上传位能用 Tab 聚焦，按 Enter 或空格打开文件选择。
- 弹窗用原生 `<dialog>` 加 `showModal()`，自带焦点限制和 Esc 关闭；`aria-labelledby` 指向弹窗标题；关闭后焦点回到触发按钮。
- 保留 `:focus-visible` 的描边，不要写 `outline: none`。
- 图片都写 alt：封面用模板标题；结果用"{模板名}的制作结果"；素材预览用"第 N 张素材预览"。
- 状态不只靠颜色区分，同时配有文字。

## 12. Next 16 注意事项

`next.config.ts`：

```ts
const backend = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8080';
export default {
  output: 'standalone',
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/demo/:path*', destination: `${backend}/demo/:path*` },
    ];
  },
} satisfies NextConfig;
```

- **rewrites 的目标地址在构建时确定**，所以 Docker 构建时要通过 build arg 传入。
- **`images.unoptimized`**：受保护的图片必须由浏览器带着 Cookie 直接请求。Next 的图片优化器在服务端取图，不带 Cookie，会拿到 401。
- 动态路由的 `params` 是 Promise，要写成 `const { id } = await params`。
- 用到 `useSearchParams` 的客户端组件必须包在 `<Suspense>` 里，否则 `next build` 会报错。
- `proxy.ts` 的 matcher 只匹配页面路径，排除 `/api`、`/demo`、`/_next`、`/login` 和静态文件。不要让它处理上传请求。
- 脚本：
  - `"lint": "eslint ."`（Next 16 已删除 `next lint`）
  - `"typecheck": "tsc --noEmit"`
  - `"test": "vitest run"`
- `@types/node` 改为 `^24`，和运行时保持一致。
- 如果 Turbopack 构建 standalone 出问题，退回 `next build --webpack`。
