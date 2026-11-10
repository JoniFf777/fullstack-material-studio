# 06 验证与测试方案

## 1. 目标与原则

- **每条需求都能被验证**：除了 R-11（界面）和 R-13（材料）只能人工核对，其他需求都至少有一项自动化验证和一个人工场景（§2）。
- **验证先行**：
  - 三样验证资产在编码前（I0）就位：契约夹具、API 冒烟脚本、人工清单。
  - 核心模块先写测试，再写实现：后端的流水线和状态守卫、前端的任务跟踪。
- **分层验证**：静态检查 → 单元测试 → 集成测试 → 契约比对 → API 冒烟 → 人工走查。越靠前越快，问题尽量在靠前的层发现。
- **断言结果，不断言实现**：测状态、数据、界面上的文字。只有当"调用次数"本身就是需求时才数请求次数，例如"任务结束后停止轮询"。
- **不用 sleep 断言**：后端用 Awaitility 等到条件满足；前端用假定时器推进时间。
- **有证据**：每个"通过"都能指出是哪个测试、哪段冒烟输出、哪条日志或哪张截图。
- **缺陷先补测试再修**（§11）。

## 2. 需求追踪矩阵

| 需求 | 自动化验证 | 人工场景（§8） | 额外证据 |
|---|---|---|---|
| R-01 栈与职责 | CI：前端 build、后端 verify；冒烟经 :3000（Next rewrites）访问 Java | S03 | CI 记录、冒烟输出 |
| R-02 列表与模拟数据 | `TemplateIT`；冒烟 `templates` 段 | S01 | |
| R-03 详情、上传与校验 | `MaterialUploadIT`、`TaskSubmissionIT`、`ImageSnifferTest`；前端 `uploadSlotsReducer`、`validateFile`、`createPanel`；冒烟 `upload` 段 | S01、S02 | |
| R-04 受理与异步执行 | `TaskFlowIT` ①；冒烟 `tasks` ①（受理耗时） | S03、S07 | |
| R-05 多步骤状态与查询 | `TaskPipelineTest` ①⑤⑥；`TaskStateGuardIT`；`TaskFlowIT` ①③⑦；冒烟 `tasks` ②（阶段只前进） | S03、S13 | 日志 STEP_*；`generation_task_step` 表 |
| R-06 失败与模拟控制 | `TaskPipelineTest` ②③④；`StepSimulatorTest`；`SimulationSettingsTest`；`TaskFlowIT` ②④；冒烟 `tasks` ③④ | S04、S06 | |
| R-07 状态表达与请求异常 | 前端 `taskView`、`taskTracking` ③、`createPanel`；`TaskFlowIT` ⑤；冒烟 `tasks` ⑤ | S02、S03、S09 | 截图 |
| R-08 多任务与查询生命周期 | 前端 `taskTracking` ①②④、`authReset`；`TaskFlowIT` ⑦ | S05、S10、S11 | Network 面板截图 |
| R-09 刷新恢复与结果 | 前端 `taskTracking` ⑤；冒烟 `tasks` ②（结果图可取） | S08 | |
| R-10 身份与个人记录 | `AuthIT`；`TaskFlowIT` ⑥；冒烟 `auth`、`isolation` 段 | S11 | |
| R-11 界面与交互 | ESLint（含 jsx-a11y 规则） | 键盘走查、375px 走查、对照截图（§8.2） | 截图 |
| R-12 CI 与关键测试 | CI 三个 job | 查看 Actions 页面 | CI 链接 |
| R-13 提交材料 | — | 按 07 §7 逐项核对 README | |
| R-14 容器交付 | CI 的 compose job（构建、启动、冒烟） | 从零执行 `docker compose up --build` | |

## 3. 阶段门槛

满足全部条件才能进入下一阶段。`smoke` 指 `node verify/smoke.mjs`。

| 阶段 | 通过条件 |
|---|---|
| I0 | `smoke --self-check` 通过：每个夹具都按 03 §2 的类型、枚举和状态表校验通过，比对与校验逻辑的自测通过 |
| B0 | `./mvnw test` 通过；应用以 local profile 启动后 `/actuator/health` 为 UP |
| B1 | Flyway 迁移成功；能查到 5 个分类、9 个模板、2 个用户；已生成 9 张封面和 6 个样例文件，`smoke --self-check` 的样例和封面检查全部为 ✓（不再有 ⚠） |
| B2 | `TemplateIT` 通过；`smoke http://localhost:8080 --only templates` 通过 |
| B3 | `AuthIT`、`SeedPasswordTest` 通过；`smoke … --only auth` 通过 |
| B4 | `MaterialUploadIT`、`ImageSnifferTest` 通过；`smoke … --only upload` 通过 |
| B5 | `TaskPipelineTest`、`StepSimulatorTest`、`SimulationSettingsTest`、`TaskStateGuardIT`、`TaskSubmissionIT`、`TaskFlowIT`、`TaskRecoveryIT` 通过；`smoke http://localhost:8080` 全部段通过 |
| B6 | §4 的全部用例通过；curl 自测记录写进 `backend/DECISIONS.md` |
| B7 | `docker build backend` 成功；容器能连上 compose 里的 MySQL，健康检查通过 |
| F0 | `npm run lint`、`npm run typecheck`、`npm run build` 通过 |
| F1 | `apiClient.test.ts`、`fixtures.test.ts` 通过（全部夹具都能通过前端的响应校验） |
| F2–F4 | 对应的单元测试通过；手动核对 S01、S02 |
| F5 | `taskView`、`mergeTask`、`taskTracking`、`createPanel` 通过；手动核对 S03–S10 |
| F6 | §5 的全部用例通过 |
| F7 | `docker build frontend` 成功 |
| I3 | `docker compose down -v && docker compose up --build --wait` 成功；`smoke`（经 :3000）全部通过；`verify/CHECKLIST.md` 的 S01–S13 全部打勾 |
| 交付 | CI 三个 job 全绿；07 §9 的提交前检查全部完成 |

## 4. 后端测试设计

### 4.1 分层与工具

| 层 | 工具 | 运行环境 |
|---|---|---|
| 单元 | JUnit 6、Mockito。优先用内存假实现，少用 mock | 任何环境 |
| 集成 | `@SpringBootTest` + MockMvc + Testcontainers（`mysql:8.4`） | 有 Docker 时运行；没有就自动跳过 |
| 冒烟 | `verify/smoke.mjs` | 本地运行的应用或 Compose |

### 4.2 测试基础设施

- **基类 `AbstractIntegrationTest`**：
  - 注解 `@SpringBootTest`、`@AutoConfigureMockMvc`、`@Testcontainers(disabledWithoutDocker = true)`。
  - 静态单例 `MySQLContainer("mysql:8.4")`，配合 `@ServiceConnection`。所有集成测试类共用一个容器，只启动一次。
- **测试配置**：
  - `STORAGE_ROOT` 指向临时目录。
  - `DEV_API_ENABLED=true`。
  - 三步耗时默认为 0，`TASK_WORKERS=2`。
- **模拟配置是全局的**：
  - 需要观察中间状态的用例，在用例里调开发接口设置耗时。
  - 每个用例结束时（`@AfterEach`）调用 reset。
  - 不开启并行测试。
- **用户隔离**：每个用例注册一个随机用户名的新用户（`TestUsers.register(mockMvc)`）。不清表，用例之间互不影响。
- **测试图片**：
  - `TestImages.jpeg(w, h)`、`TestImages.png(w, h)` 用 ImageIO 现场生成字节。
  - `TestImages.fakeJpeg()` 生成文本内容的伪装文件。
  - 不依赖 `samples/`。
- **等待**：用 `await().atMost(10, SECONDS).pollInterval(100, MILLISECONDS)`。禁止先 `Thread.sleep` 再断言。
- **时间**：单元测试注入固定的 `Clock`；集成测试用系统时钟。

### 4.3 单元测试（不依赖数据库）

| 测试类 | 用例 |
|---|---|
| `TaskPipelineTest`<br>（内存版 TaskStateStore；记录调用顺序的假步骤；耗时 0） | ① 全部成功：执行顺序为 素材检查 → 模拟生成 → 结果整理；状态序列正确；写入 resultKey<br>② 参数化，三个阶段各注入一次失败：该阶段之后的步骤都没有被调用；任务 FAILED；failedStage 正确；errorCode=SIMULATED_FAILURE；步骤记录是"之前的成功、当前的失败、之后的没有"<br>③ 步骤抛出业务失败（如分辨率过低）：同样中断，errorCode 是业务码<br>④ 步骤抛出 RuntimeException：记为 INTERNAL_ERROR 并中断<br>⑤ claim 失败（任务已结束）：一个步骤都不执行，也不写任何状态<br>⑥ enterStage 的守卫返回 false：立即停止，之后不再写任何状态 |
| `StepSimulatorTest` | 命中失败阶段时抛异常；没命中时不抛；延迟按快照执行 |
| `SimulationSettingsTest` | PATCH 只修改传入的字段；越界的耗时、非法的阶段被拒绝；reset 回到默认值；快照与 JSON 互相转换后不变 |
| `ImageSnifferTest` | 正确识别 JPEG、PNG；文本文件、截断的文件被拒绝 |
| `SeedPasswordTest` | 种子数据里的 BCrypt 哈希能匹配 demo123、alice123 |

### 4.4 集成测试（Testcontainers）

| 测试类 | 用例 |
|---|---|
| `TaskFlowIT` | ① **受理不等待**：三步耗时各设为 800ms。`POST /api/tasks` 在 1 秒内返回 202，状态是 PENDING 或 PROCESSING，带 Location 头。随后等待到 SUCCEEDED，检查三条步骤按 startedAt 递增且都成功，结果图返回 200 image/jpeg<br>② **指定阶段失败**（参数化三个阶段）：任务 FAILED；failedStage 正确；该阶段之后没有步骤记录；resultUrl 为 null。之后再 GET 3 次，仍是 FAILED，且 updatedAt 不变<br>③ **查询不推进**：模拟生成耗时设为 3 秒，等到 stage=GENERATING 后连续 GET 10 次（间隔 50ms），每次 stage 和 updatedAt 都不变；之后正常完成<br>④ **快照隔离**：failStage=GENERATING 时提交 A，reset 后提交 B，最终 A 失败、B 成功<br>⑤ **查询故障**：打开 queryOutage 后，列表和详情都返回 503 SERVICE_UNAVAILABLE；直接查数据库，确认任务在故障期间仍跑到 SUCCEEDED；关闭开关后 GET 看到 SUCCEEDED<br>⑥ **用户隔离**：alice 访问 demo 的任务、结果、素材内容都是 404；alice 的列表里没有 demo 的任务<br>⑦ **多任务不串**：同一用户连续提交 3 个任务（素材组合各不相同）。全部完成后，每个任务的 materials 和提交时一致，三个结果文件的 sha256 互不相同 |
| `TaskStateGuardIT` | 直接调用 mapper：对 SUCCEEDED 和 FAILED 的任务执行 claim、enterStage、succeed、fail，受影响行数都是 0，数据不变 |
| `TaskSubmissionIT` | 数量不符、素材重复、用别人的素材、模板不存在、类型不被接受、超过模板大小，分别返回对应的错误码，且都不建任务。相同的 Idempotency-Key 提交两次得到同一个 id；两个线程并发提交，也只建一条任务 |
| `MaterialUploadIT` | 正常上传返回 201；伪装成 .jpg 的文本返回 400 FILE_TYPE_NOT_ALLOWED；超过模板大小返回 400 FILE_TOO_LARGE；超过 10MB 返回 413 FILE_TOO_LARGE；空文件返回 400 FILE_EMPTY；未知模板返回 404；未登录返回 401 |
| `AuthIT` | 登录返回 200，Cookie 带 HttpOnly 和 SameSite=Lax；me 返回 200，且带 X-User-Id；退出返回 204，之后 me 返回 401；错误密码返回 401 INVALID_CREDENTIALS；注册重名返回 409；注册字段不合法返回 400，带 fieldErrors |
| `TemplateIT` | 5 个分类，其中婚礼的 templateCount 为 0；全部模板 8 个；萌宠 2 个；未知分类返回空列表；wedding-invite 和不存在的 id 都返回 404 |
| `TaskRecoveryIT` | 直接插入 PROCESSING（含 RUNNING 步骤）和 PENDING 的任务，调用恢复逻辑：PROCESSING 变为 FAILED(INTERRUPTED)，failedStage 等于原来的 stage，步骤变为 FAILED；PENDING 被派发并最终完成 |
| `ContractShapeIT`（P1） | 用 §6.2 的规则比对真实响应和 `../verify/fixtures`；找不到夹具目录时跳过 |

## 5. 前端测试设计

### 5.1 工具与环境

- 工具：Vitest 5、jsdom、@testing-library/react、@testing-library/user-event、@testing-library/jest-dom。
- 每个测试新建一个 QueryClient：`retry: false`（专门测重试的用例除外），`gcTime: Infinity`。
- 假定时器：`vi.useFakeTimers({ shouldAdvanceTime: true })`，用 `await vi.advanceTimersByTimeAsync(ms)` 推进时间。

### 5.2 假 API（`src/test/fakeApi.ts`）

- **注册响应**：`fakeApi.on('GET', '/api/tasks/1', [响应1, 响应2, …])`，按顺序返回脚本化的响应；序列用完后一直返回最后一个。
- **响应种类**：`json(status, body)`、`networkError()`、`delayed(ms, 响应)`。
- **记录**：
  - `fakeApi.calls('GET', '/api/tasks/1')`：调用次数
  - `fakeApi.signals(...)`：每次调用收到的 AbortSignal，用来断言请求是否被取消
  - `fakeApi.headers(...)`：每次请求的请求头，用来断言 Idempotency-Key
- **安装**：`vi.stubGlobal('fetch', fakeApi.fetch)`；上传用的 XHR 换成一个最小的假 XHR 类。
- **响应体**：取自 `verify/fixtures`，用 `fs.readFileSync` 读取，再按需覆盖字段，例如 `withTask(fixture, { id: 2, status: 'FAILED' })`。

### 5.3 单元测试

| 文件 | 用例 |
|---|---|
| `taskView.test.ts` | PENDING、PROCESSING、SUCCEEDED、FAILED 分别对应的视图。**PROCESSING + 查询出错：仍显示"处理中"，并带"状态更新失败"的提示；文案里没有"失败 ·"**。FAILED 显示失败阶段和原因；404 显示"任务不存在" |
| `mergeTask.test.ts` | 终态不会被非终态覆盖；updatedAt 更旧的数据被忽略；正常的推进会被接受 |
| `uploadSlotsReducer.test.ts` | 旧 uploadId 的进度、成功、失败事件都被忽略；替换后进度归零；移除后回到 empty；全部 ready 时才可提交 |
| `validateFile.test.ts` | 类型和大小不符时的提示文案 |
| `apiClient.test.ts` | 2xx 正常解析；4xx 解析成带 code 的 ApiError(http)；fetch 抛错时变成 ApiError(network)；AbortError 原样抛出；401 时调用 onUnauthorized；X-User-Id 不一致时抛 SessionChangedError（P1） |
| `fixtures.test.ts` | 全部夹具都能通过前端的响应校验，枚举值都合法 |

### 5.4 组件测试

| 文件 | 用例 |
|---|---|
| `taskTracking.test.tsx` | ① **多任务不串扰**：A 依次返回 PROCESSING、SUCCEEDED；B 返回 PROCESSING、FAILED。A 的卡片显示 A 的结果图地址，B 的卡片显示 B 的失败原因<br>② **终态即停**：A 结束后继续推进时间，A 的请求次数不再增加；两个任务都结束后，不再有任何请求<br>③ **查询异常不等于失败**：B 的查询返回 503，B 显示"状态更新失败"和"重新查询"按钮，没有"失败"字样；A 照常推进。点击"重新查询"后 B 恢复轮询并显示真实状态<br>④ **卸载清理**：卸载组件后推进时间，不再有请求；卸载前正在进行的请求收到 abort<br>⑤ **刷新恢复**：用列表数据（一个 PROCESSING、一个 SUCCEEDED）渲染，只有 PROCESSING 的那个发出轮询请求，并最终更新到终态 |
| `createPanel.test.tsx` | 素材没齐时按钮禁用并显示还差几张 → 全部就绪后可点 → 点击后显示"提交中"且禁用 → 收到 202 后按钮恢复、上传位清空、新任务出现在列表缓存最前面。提交返回 400 时显示 message 并保留上传位。网络错误后重试，两次请求的 Idempotency-Key 相同 |
| `authReset.test.tsx`（P1） | 退出后缓存被清空，旧用户的任务不再渲染，进行中的请求被 abort |

### 5.5 测试先行的顺序（F5）

1. 先写 `taskView`、`mergeTask`、`taskTracking` 的测试，此时全部失败。
2. 再实现 `deriveTaskView`、`mergeTask`、`useTrackedTask`、`TaskCard`，直到测试全部通过。
3. 最后接到页面上，手动核对 S03–S10。

## 6. 契约一致性

### 6.1 夹具清单（`verify/fixtures/`，I0 由 Claude 根据 03 §2 编写）

| 文件 | 内容 |
|---|---|
| `user.json` | `{ user: UserDto }` |
| `categories.json` | `{ items: CategoryDto[] }`，与种子数据一致的 5 个分类 |
| `templates.json` | `{ items: TemplateSummaryDto[] }`，2 条 |
| `template-detail.json` | `TemplateDetailDto`（travel-postcard） |
| `material.json` | `MaterialDto` |
| `task-pending.json` | `TaskDto`，PENDING |
| `task-processing.json` | `TaskDto`，PROCESSING，模拟生成运行中 |
| `task-succeeded.json` | `TaskDto`，SUCCEEDED |
| `task-failed.json` | `TaskDto`，在模拟生成阶段 FAILED，errorCode 为 SIMULATED_FAILURE |
| `task-list.json` | `{ items: TaskDto[] }` |
| `simulation.json` | `SimulationSettingsDto` |
| `error-validation.json` | `ApiErrorBody`，VALIDATION_FAILED，带 fieldErrors |
| `error-not-found.json` | `ApiErrorBody`，TASK_NOT_FOUND |

### 6.2 比对规则（冒烟脚本和 `ContractShapeIT` 共用）

- **对象**：字段名集合必须完全相同，多一个或少一个都算不一致。
- **值类型**：string、number、boolean、array、object 必须一致。`null` 与任何类型都兼容，因为可空字段在不同状态下可能为 null。
- **数组**：两边都不为空时，比对第一个元素。
- **枚举**：status、stage、failedStage、步骤的 status、failStage 的值，必须在 03 §2 规定的范围内。

### 6.3 谁在哪里用

- **前端**：测试里的假响应都来自夹具；`fixtures.test.ts` 用前端的响应校验把每个夹具跑一遍。
- **后端**：`ContractShapeIT`（P1）用真实响应和夹具比对。
- **冒烟**：每个接口的真实响应都和夹具比对一次。
- **契约变更**：由 Claude 在同一个提交里修改 03 和夹具，再通知双方改代码。

## 7. API 冒烟（`verify/smoke.mjs`）

### 7.1 用法

```bash
node verify/smoke.mjs                          # 默认 http://localhost:3000，经过 Next 代理
node verify/smoke.mjs http://localhost:8080    # 直连后端（前端还没好时）
node verify/smoke.mjs http://localhost:8080 --only tasks
node verify/smoke.mjs --self-check             # 不联网，只检查脚本本身和夹具
```

- 运行环境是 Node 24，不需要第三方依赖（用内置的 fetch、FormData、Blob）。脚本自己解析 `Set-Cookie`，分别维护 demo 和 alice 两个用户的 Cookie。
- `templates`、`auth`、`upload` 三段不需要开发接口，B2–B4 就能用；`tasks`、`isolation` 需要开发接口（`DEV_API_ENABLED=true`，B5 起）。
- 跑 `tasks` 或 `isolation` 时，开始和结束都调用 `POST /api/dev/simulation/reset`。为了跑得快，开头把三步耗时设为 300 / 600 / 300 ms，需要观察中间状态的检查再单独设置。
- 除了按 §6.2 比对字段，每个任务响应还会按 03 §2 的状态表检查（字段之间不能矛盾）；轮询时检查状态只前进、终态之后完全不变。
- 每条检查输出 ✓ 或 ✗，并附耗时；⚠ 是不影响结果的提示。有任何失败，退出码为 1。
- `upload`、`tasks`、`isolation` 依赖 `samples/` 下的样例文件（B1 生成）；`--samples <目录>` 可以换一个目录。
- I0 时用一个按契约实现的临时假后端验证过脚本本身：正常实现全部通过；注入 14 种典型缺陷（同步受理、整条流水线一个事务、不用快照、失败后继续执行、终态被修改、查询写库、状态后退、越权、多字段、幂等失效、不识别文件头、故障时停止执行、Cookie 缺 SameSite、缺 X-User-Id），每一种都会失败。

### 7.2 分段与断言

| 段 | 断言 |
|---|---|
| `templates` | 5 个分类与种子一致，婚礼的 templateCount 为 0；8 个模板按顺序返回；`?category=pets` 返回 2 个；每个分类的 templateCount 与筛选结果一致；未知分类返回空列表；8 个模板的详情与种子一致；wedding-invite 和不存在的 id 返回 404 TEMPLATE_NOT_FOUND；8 张封面能访问（image/png） |
| `auth` | demo 登录返回 200，Cookie 带 HttpOnly、SameSite=Lax、Path=/、Max-Age；me 返回 demo，响应带 X-User-Id；错误密码和不存在的用户返回 401 INVALID_CREDENTIALS；未登录和伪造 Cookie 访问 me 返回 401；注册字段不合法返回 400，fieldErrors 指出字段；注册随机用户返回 201，重名返回 409；退出返回 204 并清除 Cookie，旧 Cookie 随即失效 |
| `upload` | photo-1.jpg、photo-2.jpg、photo-3.png 上传返回 201，类型、大小、文件名正确；not-image.jpg 返回 400 FILE_TYPE_NOT_ALLOWED；large-photo.jpg 传给 hot-avatar 返回 400 FILE_TOO_LARGE；photo-3.png 传给 hot-film 返回 400 FILE_TYPE_NOT_ALLOWED；空文件返回 400 FILE_EMPTY；未知模板返回 404；未登录返回 401；自己取回的内容与原文件字节一致，别人取返回 404 |
| `tasks` | 未登录访问任务返回 401；不存在的任务返回 404；开发接口拒绝越界的取值<br>⑧ 校验（最先执行）：缺字段、模板不存在或已下线、数量不符、素材重复、素材不存在或属于别人、类型不被接受、超过大小，分别返回对应的错误码，且都不建任务<br>① 受理：返回 202，耗时小于 1 秒，状态为 PENDING 或 PROCESSING，带 Location<br>② 轮询到 SUCCEEDED：只前进、能观察到执行中的阶段、三条步骤都成功且顺序正确；结果图返回 200 image/jpeg；列表按 id 倒序，templateId 和 limit 生效<br>③ failStage=GENERATING 连续提交两次，都在模拟生成阶段 FAILED，没有结果整理步骤，之后再查不变；failStage=MATERIAL_CHECK 在素材检查阶段 FAILED<br>④ 快照隔离：A 在 failStage=RESULT_ASSEMBLY 时受理，失败；reset 后受理的 B 成功，且 B 的结果图与 ② 的不同<br>⑤ 模拟生成期间连续查询 8 次，stage 和 updatedAt 都不变（查询不推进）；打开 queryOutage 后列表和详情返回 503，结果图接口不受影响，并且在故障期间就能取到结果（任务照常完成）；关闭后查到 SUCCEEDED<br>⑥ 素材检查的真实失败：用 tiny-32.png 提交，在素材检查阶段 FAILED，errorCode 为 MATERIAL_RESOLUTION_TOO_LOW<br>⑦ 幂等：同一个 Idempotency-Key 提交两次，得到同一个 id，只建一条；换一个 key 才新建 |
| `isolation` | 两个用户的 X-User-Id 不同；alice 访问 demo 的任务、结果、素材都返回 404；alice 用 demo 的素材提交返回 400 MATERIAL_NOT_FOUND；两人的列表互不包含对方的任务；demo 退出后，旧 Cookie 访问 me 和任务都返回 401 |

### 7.3 在 CI 中运行

compose job 的步骤：

1. `docker compose up -d --build --wait`
2. `node verify/smoke.mjs`
3. 失败时输出 `docker compose logs`
4. 最后执行 `docker compose down -v`

## 8. 人工验收（`verify/CHECKLIST.md`）

人工验收默认用 Compose 启动：前端在 http://localhost:3000，开发接口在 http://localhost:8080/api/dev/simulation。Windows PowerShell 里请用 `curl.exe`。CHECKLIST 里每个场景都记录结果（✓ 或 ✗）、日期和备注。

### 8.1 演示场景（也是 README「如何演示」的底稿）

**S01 浏览与筛选**（R-02、R-03）

- Given：用 demo / demo123 登录。
- When：打开首页，依次点"萌宠"和"婚礼"，再访问 `/templates/wedding-invite`。
- Then：
  - 首页显示 5 个分类、8 个模板。
  - "萌宠"下只有 2 个模板。
  - "婚礼"显示空状态。
  - 已下线模板的详情页显示"模板不存在或已下线"。

**S02 上传交互**（R-03、R-07）

- Given：进入"旅行明信片"，它需要 2 张图。
- When / Then：
  1. 第 1 个上传位选 `photo-1.jpg`：出现进度和预览，随后标记为就绪。
  2. 换成 `photo-3.png`：旧的上传被中止，预览更新。
  3. 点移除：回到空状态。
  4. 选 `not-image.jpg`：前端放行，服务端拒绝，上传位显示原因。
  5. 进入"迷你头像"，选 `large-photo.jpg`：前端直接提示超过 200KB，不发请求。
  6. 进入"复古胶片"，选 `photo-3.png`：前端提示只支持 JPG。
- 全程：素材没齐时按钮禁用，并写明还差几张。

**S03 成功流程**（R-04、R-05、R-07）

- Given：默认配置。
- When：两张图都就绪后，点"立即制作"。
- Then：
  - 按钮短暂显示"提交中"，随即恢复。
  - 历史区最前面出现新卡片，依次显示：等待处理 → 处理中 · 素材检查 → 模拟生成 → 结果整理 → 已完成，最后显示结果图。
  - 点卡片能打开大图预览。
  - `docker compose logs backend` 里能看到三步各自的 STEP_START 和 STEP_END。

**S04 指定阶段失败**（R-06）

- Given：`PATCH {"failStage":"GENERATING"}`。
- When：提交一个任务。
- Then：
  - 卡片停在"失败 · 模拟生成"，显示原因。
  - 步骤条里"结果整理"是灰色，说明没有执行。
  - 再提交一个，仍在同一阶段失败（可重复触发）。
  - reset 之后恢复正常。

**S05 多任务互不串扰与排队**（R-04、R-08）

- Given：
  - 以 `TASK_WORKERS=1` 重启后端（PowerShell：`$env:TASK_WORKERS=1; docker compose up -d backend`）。
  - 设置 `PATCH {"failStage":"RESULT_ASSEMBLY"}`。
- When：提交任务 A → reset → 马上提交 B 和 C。
- Then：
  - B 或 C 有一段时间显示"等待处理"（排队）。
  - A 在"结果整理"阶段失败，B、C 成功。
  - 三张卡片的阶段、原因、结果各不相同。结果图分别由各自的素材拼成。

**S06 调整耗时**（R-06）

- 设置 `PATCH {"delaysMs":{"GENERATING":10000}}` 后提交，"模拟生成"阶段持续约 10 秒。

**S07 关闭页面不中断**（R-04）

- 提交后关闭标签页，15 秒后打开 `/history`，任务已经完成。

**S08 刷新恢复**（R-09）

- 任务处理中时按 F5：列表从后端恢复，未完成的任务继续更新直到结束。

**S09 查询异常不等于任务失败**（R-07）

- Given：一个任务正在处理（把模拟生成调到 10 秒）。
- When：设置 `PATCH {"queryOutage":true}`，等几秒后再设置 `PATCH {"queryOutage":false}`，然后点卡片上的"重新查询"。
- Then：
  - 故障期间，卡片保持"处理中"，并显示黄色提示"状态更新失败，任务仍在后台处理"，没有"失败"字样。
  - 恢复后点"重新查询"，卡片显示真实状态，通常已经完成。
- 也可以在浏览器开发者工具里切到 Offline 来模拟。

**S10 停止轮询**（R-08）

- 所有任务结束后，开发者工具的 Network 面板不再出现 `/api/tasks/{id}` 请求。
- 任务处理中时，从详情页回到首页，相关请求停止。

**S11 用户隔离与切换**（R-10、R-08）

- When：demo 名下已有任务 → 在账号弹窗里点"切换账号" → 用 alice / alice123 登录。
- Then：
  - alice 看不到 demo 的任务。
  - 直接访问 demo 某个任务的 `/api/tasks/{id}/result`，返回 404。
  - 切换过程中没有闪现 demo 的数据。

**S12 重启边界**（README 说明项）

- Given：
  - 以 `TASK_WORKERS=1` 启动后端。
  - 设置 `PATCH {"delaysMs":{"GENERATING":60000}}`，提交任务 A。
  - reset，再提交任务 B。此时 B 在排队。
- When：A 处于"模拟生成"阶段时，执行 `docker compose restart backend`。
- Then：
  - A 变为"失败 · 模拟生成"，原因是"服务重启，任务执行被中断，请重新提交"。
  - B 在重启后自动执行并完成。

**S13 素材检查的真实失败**（R-05）

- When：在"萌宠贴纸"上传 `tiny-32.png`（能上传成功），然后提交。
- Then：卡片显示"失败 · 素材检查"，原因是"第 1 张图片分辨率过低（32×32），至少需要 64×64"。

### 8.2 键盘与小屏走查（R-11）

- **只用键盘**：用 Tab 依次经过分类、卡片、上传位、替换和移除、提交按钮、账号按钮。
  - 在上传位上按 Enter 能打开文件选择。
  - 打开账号弹窗后，焦点在弹窗内；按 Esc 关闭后，焦点回到账号按钮。
  - 全程能看见焦点框。
- **小屏 375×812**（开发者工具的设备模式）：列表显示 2 列，详情页上下堆叠，所有按钮都能点，没有横向滚动。
- **对照截图**：对照 UI-01 到 UI-04，检查主要布局是否一致。

### 8.3 证据收集

- 关键场景截图，放到 `docs/screenshots/`（可选，README 里引用）：
  - S03 处理中
  - S04 失败
  - S09 查询异常提示
  - S10 Network 面板
- 数据库证据：执行 `SELECT stage, status, started_at, finished_at, message FROM generation_task_step WHERE task_id = ?`，证明步骤边界记录在服务端。
- 日志证据：`docker compose logs backend | grep STEP_`。

## 9. CI（`.github/workflows/ci.yml`）

- 触发条件：`push`、`pull_request`。
- **frontend job**（工作目录 frontend）：
  1. setup-node 24（开启 npm 缓存）
  2. `npm ci`
  3. `npm run lint`
  4. `npm run typecheck`
  5. `npm test`
  6. `npm run build`
- **backend job**（工作目录 backend）：
  1. setup-java Temurin 21（开启 maven 缓存）
  2. `chmod +x mvnw`
  3. `./mvnw -B verify`

  GitHub 的 ubuntu runner 自带 Docker，Testcontainers 用例会真正执行。
- **compose job**（依赖前两个 job）：
  1. `docker compose up -d --build --wait`
  2. `node verify/smoke.mjs`
  3. 失败时输出日志
  4. `docker compose down -v`

## 10. 给评审的容器内验证命令

源码以只读方式挂载，复制进容器后再构建。不在宿主机执行项目脚本，也不往源码目录写东西。

```bash
# 一键启动
docker compose up --build

# 后端测试（容器里没有 Docker 时，Testcontainers 用例会自动跳过）
docker run --rm -v "$PWD:/src:ro" maven:3.9-eclipse-temurin-21 \
  sh -c "cp -r /src /work && cd /work/backend && mvn -B test"

# 前端检查
docker run --rm -v "$PWD:/src:ro" node:24-alpine \
  sh -c "cp -r /src /work && cd /work/frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build"

# API 冒烟（在 Compose 启动之后；加入 Compose 的网络，经前端代理访问）
docker run --rm --network fullstack-material-studio_default -v "$PWD:/src:ro" -w /src node:24-alpine \
  node verify/smoke.mjs http://frontend:3000
```

## 11. 缺陷处理流程

1. **复现**：记录场景编号、操作步骤、实际结果、期望结果。
2. **补测试**：在最低的合适层级（单元 > 集成 > 冒烟）补一个能复现问题的测试，确认它失败。
3. **分配**：
   - 后端问题：Claude 写成修复提示词，由你转给 Codex。
   - 前端问题：Claude 直接修。
4. **回归**：修复后，跑这个测试、所在阶段的门槛，以及冒烟。
5. **记录**：写进 `DECISIONS.md` 的"问题记录"，包括现象、根因、修法和对应的测试。README 的 AI 使用说明可以引用其中一例。

## 12. 不覆盖的部分（如实说明）

- 没有浏览器端到端测试（题目不要求），用组件测试、API 冒烟和人工清单替代。
- 没有压力测试：并发只验证到 2 个 worker、3 个任务。
- 不验证多实例部署；重启恢复也只验证单实例。
- 在没有 Docker 的环境里，Testcontainers 用例会被跳过（CI 里会真正执行）。
- 视觉还原和无障碍靠人工走查和 lint 规则，没有自动化的视觉回归测试。
