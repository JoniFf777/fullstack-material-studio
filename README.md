# 素材工坊：素材制作网站

用户浏览模板、上传图片、提交制作任务；Java 后端在后台依次执行 **素材检查 → 模拟生成 → 结果整理** 三步，用户可以继续浏览，随时查看历史记录和结果图。

- 前端：Next.js 16（App Router）+ React 19 + TypeScript
- 后端：Java 21 + Spring Boot 4.1 + MyBatis + MySQL 8.4（业务接口和持久化全部在 Java 里，Next 只做转发）
- 一键启动：`docker compose up --build`

## 目录

1. [快速开始](#1-快速开始)
2. [技术栈与版本](#2-技术栈与版本)
3. [项目结构](#3-项目结构)
4. [前后端和数据库如何连接](#4-前后端和数据库如何连接)
5. [本地开发、测试与构建命令](#5-本地开发测试与构建命令)
6. [配置项](#6-配置项)
7. [数据库初始化与模拟数据](#7-数据库初始化与模拟数据)
8. [主要接口、任务状态与后台执行](#8-主要接口任务状态与后台执行)
9. [如何演示](#9-如何演示)
10. [用户身份与个人记录](#10-用户身份与个人记录)
11. [测试与验证](#11-测试与验证)
12. [完成情况与已知限制](#12-完成情况与已知限制)
13. [部署与回滚](#13-部署与回滚)
14. [AI 使用说明](#14-ai-使用说明)
15. [复用来源](#15-复用来源)

## 1. 快速开始

```bash
docker compose up --build
```

- 浏览器打开 http://localhost:3000，用演示账号登录：`demo / demo123` 或 `alice / alice123`（种子数据里的测试账号）。
- 三个服务按健康检查依次启动：mysql → backend → frontend。首次构建要下载依赖，耗时取决于网络。
- 开发接口（模拟控制）：http://localhost:8080/api/dev/simulation，也可以打开页面 http://localhost:3000/dev。
- 停止：`docker compose down`；连同数据一起清空：`docker compose down -v`。
- 不需要 `.env`：所有变量在 `docker-compose.yml` 里都有默认值。要修改时复制 `.env.example` 为 `.env`。

网络较慢时的可选做法（不写进仓库，只影响本机构建）：

```bash
# 前端：构建时换 npm 源
NPM_REGISTRY=https://registry.npmmirror.com docker compose build frontend
# 后端：把本机 Maven settings（含镜像配置）作为 BuildKit secret 传给构建，不会进入镜像层
docker build --secret id=maven_settings,src=/path/to/settings.xml -t material-studio-backend:local backend
```

## 2. 技术栈与版本

| 部分 | 组件与版本 |
|---|---|
| 运行环境 | Java 21（镜像 `eclipse-temurin:21-jre`，构建用 `maven:3.9-eclipse-temurin-21`）、Node.js 24（镜像 `node:24-alpine`）、MySQL 8.4（镜像 `mysql:8.4`） |
| 后端 | Spring Boot 4.1.2（Spring Framework 7.0.10、Tomcat 11.0.27）、mybatis-spring-boot-starter 4.1.0（MyBatis 3.5.19）、Flyway 12.4.0、MySQL Connector/J 9.7.0、Jackson 3.1.7、spring-security-crypto 7.1.2（只用 BCrypt） |
| 后端测试 | JUnit 6.0.3、Mockito 5.23.0、Awaitility 4.3.0、Testcontainers 2.0.5（`mysql:8.4`） |
| 前端 | Next.js 16.4.6、React 19.3.0、TypeScript 5.9.3、Tailwind CSS 4.3.3、TanStack Query 5.107、lucide-react 1.71 |
| 前端工具 | ESLint 9（eslint-config-next 16.4.6 + jsx-a11y 推荐规则）、Vitest 5.1 + jsdom 31 + Testing Library |
| 交付 | Docker Compose、GitHub Actions |

版本与 `backend/pom.xml`、`frontend/package-lock.json` 一致。

## 3. 项目结构

```
.
├─ backend/                 Spring Boot 后端（Maven，带 mvnw）
│  ├─ src/main/java/com/xiaoying/studio/
│  │  ├─ auth/              注册、登录、会话、@LoginUser
│  │  ├─ template/          分类与模板
│  │  ├─ material/          素材上传、文件头识别、文件存储
│  │  ├─ task/              提交、查询；task/engine/ 是异步执行引擎
│  │  ├─ simulation/        模拟配置、开发接口、查询故障开关
│  │  └─ common/            错误码、全局异常处理、时钟
│  ├─ src/main/resources/   application.yml、Flyway 迁移、MyBatis mapper、示例封面
│  ├─ Dockerfile、DECISIONS.md（实现决定与问题记录）
├─ frontend/                Next.js 前端
│  ├─ src/app/              页面：/、/templates/[id]、/history、/login、/dev
│  ├─ src/features/         auth、templates、create（上传与提交）、tasks（任务跟踪）、dev
│  ├─ src/lib/              API 客户端、契约校验、query key、格式化
│  ├─ Dockerfile、DECISIONS.md
├─ verify/                  验证资产：契约样例 fixtures/、API 冒烟脚本 smoke.mjs、人工验收清单 CHECKLIST.md
├─ samples/                 演示上传用的图片（脚本生成）
├─ scripts/                 GenerateDemoAssets.java：生成封面和样例图（只用 JDK）
├─ spec/                    设计文档：需求分析、架构、接口契约、数据、前端设计、验证方案、任务拆分
├─ docker-compose.yml、.env.example、.github/workflows/ci.yml
```

## 4. 前后端和数据库如何连接

```
             只访问 :3000（同源，浏览器自动带 HttpOnly Cookie）
 浏览器 ───────────────────────────────► Next.js :3000
                                            │ rewrites：/api/*、/demo/*
                                            ▼
                                      Spring Boot :8080 ──► MySQL 8.4（容器内 3306）
                                            │
                                            └──► /data 卷：materials/ work/ results/
```

- 浏览器只和 Next 打交道。Next 用 rewrites 把 `/api/*`、`/demo/*` 转发给后端，所以前后端同源，登录 Cookie 设为 HttpOnly 也能正常使用。
- 转发地址 `BACKEND_INTERNAL_URL` 在**构建时**写进前端产物：Compose 里通过 build arg 传 `http://backend:8080`，本地开发默认 `http://localhost:8080`。
- 图片（素材、结果）由浏览器直接带 Cookie 请求后端，所以关闭了 Next 的图片优化（`images.unoptimized`）。
- 后端用环境变量连接数据库（`DB_HOST`、`DB_PORT` 等），Compose 里是 `mysql:3306`；宿主机上的 3307 端口供本地直接运行后端时使用。
- 素材、中间产物和结果图存在后端的 `STORAGE_ROOT`（Compose 里是命名卷 `app-data` 挂到 `/data`），数据库只存相对路径。

## 5. 本地开发、测试与构建命令

后端（JDK 21）：

```bash
docker compose up -d mysql                                        # 本地数据库，宿主机端口 3307
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local           # local profile 打开开发接口
./mvnw test                                                       # 单元测试 + Testcontainers 集成测试（需要 Docker，没有 Docker 时自动跳过）
./mvnw -DskipTests package                                        # 打包
```

前端（Node 24）：

```bash
cd frontend
npm ci
npm run dev          # http://localhost:3000，需要后端在 8080 运行
npm run lint
npm run typecheck    # next typegen && tsc --noEmit
npm test             # Vitest，测试里的假响应来自 ../verify/fixtures
npm run build
```

验证：

```bash
node verify/smoke.mjs --self-check                # 不发请求：检查夹具、样例文件、封面和脚本自身
node verify/smoke.mjs http://localhost:8080       # 直连后端跑全部接口检查
node verify/smoke.mjs                             # 经过 Next（:3000）跑全部接口检查
```

## 6. 配置项

后端配置都写成 `${环境变量:默认值}`，默认值面向本地开发；Compose 里的值见 `docker-compose.yml`。以下全部是示例值，不是真实凭据。

| 环境变量 | 默认值 | Compose 中 | 说明 |
|---|---|---|---|
| `DB_HOST` / `DB_PORT` | localhost / 3307 | mysql / 3306 | 数据库地址 |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | material_studio / studio / studio_pass | 同左 | 示例值 |
| `STORAGE_ROOT` | ./data | /data | 素材、中间产物、结果的根目录 |
| `TASK_WORKERS` | 2 | 2 | 后台线程数；设成 1 可以演示排队 |
| `SIM_FAIL_STAGE` | NONE | NONE | 默认注入失败的阶段：NONE / MATERIAL_CHECK / GENERATING / RESULT_ASSEMBLY |
| `SIM_DELAY_MATERIAL_CHECK_MS` / `SIM_DELAY_GENERATING_MS` / `SIM_DELAY_RESULT_ASSEMBLY_MS` | 1500 / 4000 / 1500 | 同左 | 三步的模拟耗时 |
| `DEV_API_ENABLED` | false（local profile 为 true） | true | 开发接口开关，**生产环境必须为 false** |
| `SESSION_TTL_HOURS` | 168 | 168 | 会话有效期 |
| `SESSION_COOKIE_SECURE` | false | false | 使用 https 时设为 true |
| `MATERIAL_MIN_DIMENSION` | 64 | 64 | 素材检查要求的最小边长 |

Compose 额外的变量：`DB_ROOT_PASSWORD`、`FRONTEND_HOST_PORT`（3000）、`BACKEND_HOST_PORT`（8080）、`MYSQL_HOST_PORT`（3307）、`IMAGE_TAG`（镜像标签，默认 local）、`NPM_REGISTRY`（可选，构建前端时的 npm 源）。

前端只有一个配置项 `BACKEND_INTERNAL_URL`，在构建时生效。

## 7. 数据库初始化与模拟数据

- **建表与初始数据**：后端启动时 Flyway 自动执行 `backend/src/main/resources/db/migration/`：
  - `V1__schema.sql`：用户、会话、分类、模板、素材、任务、任务素材、任务步骤 8 张表。
  - `V2__seed.sql`：5 个分类、9 个模板（其中"婚礼请柬"已下线，用来演示空分类和 404）、2 个演示用户（BCrypt 哈希）。
- **模板设计**：图片数量覆盖 1、2、3 张；"迷你头像"限制 200KB、"复古胶片"只收 JPG、"新年贺卡"只收 PNG，用来演示校验。
- **封面和样例图**：都由 `scripts/GenerateDemoAssets.java` 用 JDK（Java2D + ImageIO）生成，随机种子固定，重复执行得到相同的文件，已提交进仓库。没有使用任何第三方图片。重新生成：`java scripts/GenerateDemoAssets.java`（JDK 21，在仓库根目录执行）。

| `samples/` 文件 | 用途 |
|---|---|
| `photo-1.jpg`、`photo-2.jpg` | 正常上传（小于 200KB，迷你头像也能用） |
| `photo-3.png` | 正常上传；"新年贺卡"只收 PNG；交给"复古胶片"会被前端拦下 |
| `large-photo.jpg` | 约 1.7MB，超过"迷你头像"的 200KB 限制 |
| `tiny-32.png` | 32×32，能上传成功，但会在素材检查阶段失败（分辨率过低） |
| `not-image.jpg` | 文本冒充 JPG：前端按扩展名放行，后端按文件头拒绝 |

## 8. 主要接口、任务状态与后台执行

所有业务接口在 `/api` 下，JSON 格式；错误统一为 `{ "code", "message", "fieldErrors" }`，message 是给用户看的中文。完整契约见 `spec/03-api.md`，`verify/fixtures/` 是对应的响应样例。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register`、`/api/auth/login`、`/api/auth/logout` | 注册并登录、登录、退出（幂等） |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/categories`、`/api/templates?category=`、`/api/templates/{id}` | 分类、模板列表、模板详情 |
| POST | `/api/materials` | 上传素材（multipart：`file`、`templateId`），校验大小、文件头、模板限制 |
| GET | `/api/materials/{id}/content` | 素材图片（只有本人能取） |
| POST | `/api/tasks` | 提交任务：校验后建任务，返回 **202** 和任务快照，响应头带 `Location`；支持 `Idempotency-Key` |
| GET | `/api/tasks?templateId=&limit=`、`/api/tasks/{id}` | 我的任务列表、任务详情（只读） |
| GET | `/api/tasks/{id}/result` | 结果图（只有成功的任务有） |
| GET / PATCH / POST | `/api/dev/simulation`、`/api/dev/simulation/reset` | 模拟控制（`DEV_API_ENABLED=true` 时存在） |
| GET | `/actuator/health` | 健康检查 |

任务字段（节选）：`status`、`stage`（当前阶段）、`failedStage`、`errorCode`、`errorMessage`、`resultUrl`、`steps[]`（每一步的状态和起止时间）、`materials[]`、`createdAt` / `startedAt` / `finishedAt` / `updatedAt`。

| status | 中文 | 说明 |
|---|---|---|
| PENDING | 等待处理 | 已受理，排队中 |
| PROCESSING | 处理中 | `stage` 为当前阶段：MATERIAL_CHECK 素材检查 → GENERATING 模拟生成 → RESULT_ASSEMBLY 结果整理 |
| SUCCEEDED | 已完成 | 终态，有 `resultUrl` |
| FAILED | 失败 | 终态，有 `failedStage`、`errorCode`、`errorMessage`，失败之后的步骤不会执行 |

三步各自做的事：素材检查（文件存在、大小一致、文件头与类型一致、能解码、边长不小于 64）；模拟生成（把用户的图片按版式画到 720×960 的画布上）；结果整理（转成 JPEG、写入结果目录、清理中间文件）。

后台执行方式：

- **数据库是事实来源**。提交接口在一个事务里写入任务（PENDING）、素材关联和模拟配置快照，**事务提交之后**才把任务 id 交给线程池（`@TransactionalEventListener(AFTER_COMMIT)`），接口本身不等待任何步骤。
- worker 用条件更新抢占任务（`WHERE status='PENDING'`），然后依次执行三步。每次状态变更都是独立的短事务，所以查询能实时看到当前阶段；`generation_task_step` 表记录每一步的起止时间和结果。
- 所有状态更新语句都带状态条件，SUCCEEDED、FAILED 是终态，不会被改回；查询接口只读，不推进任务。
- 模拟配置（失败阶段、三步耗时）在受理时存成快照，之后修改配置不影响已受理的任务；失败注入发生在实际工作之前，不会留下半成品文件。
- 换成 RocketMQ 等消息队列时，只需新增一个 `TaskDispatcher` 实现；抢占机制保证"至少一次"投递下不会重复执行。

## 9. 如何演示

开发接口可以在页面 http://localhost:3000/dev 上操作，也可以用命令。Windows PowerShell 5.1 会吃掉传给 `curl.exe` 的 JSON 引号，所以另外给出 `Invoke-RestMethod` 写法；它访问 `localhost` 时会先尝试 IPv6，在部分 Docker Desktop 环境里会卡到超时，所以地址写 `127.0.0.1`：

```bash
SIM=http://localhost:8080/api/dev/simulation
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"failStage":"GENERATING"}' $SIM          # 指定失败阶段
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"delaysMs":{"GENERATING":10000}}' $SIM   # 调整耗时
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"queryOutage":true}' $SIM                # 模拟查询故障
curl -s -X POST $SIM/reset                                                                          # 恢复默认
```

```powershell
$sim = 'http://127.0.0.1:8080/api/dev/simulation'
Invoke-RestMethod -Method Patch -Uri $sim -ContentType 'application/json' -Body '{"failStage":"GENERATING"}'
Invoke-RestMethod -Method Post -Uri "$sim/reset"
```

| 场景 | 操作 | 看到的结果 |
|---|---|---|
| 成功 | 进入"旅行明信片"，上传 `photo-1.jpg`、`photo-2.jpg`，点"立即制作" | 按钮短暂显示"提交中…"；右侧历史最前面出现新卡片，依次显示 等待处理 → 处理中 · 素材检查 → 模拟生成 → 结果整理 → 已完成；点卡片看大图和每步耗时；`docker compose logs backend` 里能看到每步的 STEP_START / STEP_END |
| 指定阶段失败 | 设置 `failStage=GENERATING` 后提交 | 卡片停在"失败 · 模拟生成"并显示原因，结果整理为灰色；再提交仍然失败（可重复）；reset 后恢复 |
| 调整耗时 | 设置 `delaysMs.GENERATING=10000` 后提交 | 模拟生成持续约 10 秒 |
| 多任务与排队 | `TASK_WORKERS=1 docker compose up -d backend`（PowerShell 写法和恢复方法见 `verify/CHECKLIST.md` §0.2），连续提交几个任务 | 后提交的任务先显示"等待处理"；各卡片的阶段、原因、结果图互不串扰 |
| 刷新恢复 | 任务处理中时刷新页面，或关闭标签页过一会儿再打开"我的作品" | 记录从后端恢复，未完成的任务继续更新 |
| 查询故障 ≠ 任务失败 | 任务处理中时打开 `queryOutage` | 卡片仍显示"处理中"，附黄色提示"状态更新失败，任务仍在后台处理"和"重新查询"；关闭故障后点"重新查询"看到真实状态 |
| 真实的素材检查失败 | 在"萌宠贴纸"上传 `tiny-32.png` 后提交 | "失败 · 素材检查"，原因"第 1 张图片分辨率过低（32×32），至少需要 64×64" |
| 上传校验 | "迷你头像"选 `large-photo.jpg`；"复古胶片"选 `photo-3.png`；任意模板选 `not-image.jpg` | 前两个在前端直接提示、不发请求；第三个被后端按文件头拒绝 |

完整的人工验收清单（S01–S13、键盘和小屏走查）见 `verify/CHECKLIST.md`。

## 10. 用户身份与个人记录

- **账号**：用户名 + 密码注册登录，密码用 BCrypt 存储（只引入 spring-security-crypto，没有 Spring Security 过滤器链）。
- **会话**：登录成功后生成 32 字节随机令牌，写入 Cookie `XY_SESSION`（HttpOnly、SameSite=Lax、Path=/）；数据库只存令牌的 SHA-256。有效期 168 小时；退出时删除会话，并清除 Cookie。
- **个人记录**：素材、任务、结果图的所有查询都按当前用户过滤，访问别人的数据一律返回 404（不暴露是否存在）；用别人的素材提交返回 400。
- **浏览器缓存**：素材和结果图的响应带 `Cache-Control: private, max-age=86400` 和 `Vary: Cookie`，浏览器缓存按登录会话区分。联调时发现：没有 `Vary: Cookie` 时，同一个浏览器切换账号后，新用户能从缓存里读到上一个用户看过的结果图（服务端本身返回 404）；补上之后已在浏览器里复验。
- **前端**：
  - 用户相关的缓存 key 都以 `['u', userId]` 开头，不同用户的数据在缓存里天然分开。
  - 退出、切换账号或会话失效（任何请求返回 401）时：中止进行中的请求 → 清空缓存 → 中止上传 → 回到登录页，旧用户的数据不会闪现。
  - 每个认证通过的响应带 `X-User-Id`，前端发现与当前用户不一致（另一个标签页换了账号）时重新同步；登录、退出也通过 BroadcastChannel 通知其他标签页。
- **演示**：用 demo 提交几个任务 → 右上角头像打开账号弹窗 → "切换账号" → 用 alice 登录，看不到 demo 的任何记录；以 alice 身份直接访问 demo 某个任务的 `/api/tasks/{id}/result` 返回 404。

## 11. 测试与验证

| 层 | 内容 | 命令 |
|---|---|---|
| 后端单元测试 | `TaskPipelineTest`：三步按顺序执行；任一步失败后后续步骤不执行、记录失败阶段和原因；状态写入异常时不误判为业务失败。另有模拟器、模拟配置、文件头识别、种子密码等 | `./mvnw test` |
| 后端集成测试（Testcontainers + MySQL 8.4） | `TaskFlowIT`（受理不等待、指定阶段失败、查询不推进、快照隔离、查询故障、用户隔离、多任务结果互不相同）、`TaskStateGuardIT`（终态不能被改回）、`TaskSubmissionIT`（校验与幂等，含并发）、`TaskRecoveryIT`（重启恢复）、`AuthIT`、`MaterialUploadIT`、`TemplateIT`、`ContractShapeIT` 等，共 59 项 | 同上 |
| 前端单元与组件测试（Vitest） | `taskTracking`（多任务不串扰、任务结束即停止轮询、查询异常不显示为失败、卸载时取消请求、刷新恢复）、`taskView`、`mergeTask`（终态不回退）、`createPanel`（按钮状态、Idempotency-Key 重试复用）、`uploadSlotsReducer`、`validateFile`、`apiClient`、`fixtures`、`authReset`，共 60 项 | `npm test` |
| 契约一致性 | `verify/fixtures/` 是接口响应样例；前端测试用它当假响应，后端 `ContractShapeIT` 和冒烟脚本用它比对字段集合 | — |
| API 冒烟 | `verify/smoke.mjs`：模板、账号、上传、任务（受理耗时、阶段只前进、指定阶段失败、快照隔离、查询故障、真实素材检查失败、幂等、校验）、用户隔离，共 69 项 | `node verify/smoke.mjs` |
| 人工验收 | `verify/CHECKLIST.md`：S01–S13 演示场景、键盘与小屏走查 | — |
| CI | `.github/workflows/ci.yml`：push 和 pull request 时运行 frontend（lint、typecheck、test、build）、backend（`./mvnw verify`，含 Testcontainers）、compose（从零构建启动后经 :3000 跑冒烟）三个 job。仓库目前只在本地，还没有在 GitHub 上跑过；三个 job 做的事都在本机用同样的命令跑通过：前端 lint、typecheck、60 项测试和构建，后端 59 项测试，从零构建后的冒烟 69 项。 | — |

## 12. 完成情况与已知限制

已完成：

- 模板浏览（分类筛选、空分类、已下线模板）、模板详情、多图上传（选择、预览、替换、移除、进度、失败原因，前后端双重校验）、防重复提交。
- 异步任务：受理即返回，三步独立可观察，状态与失败原因持久化，终态不回退；指定阶段失败、调整耗时、查询故障都可以通过开发接口或 `/dev` 页面控制。
- 历史记录与结果：详情页右侧的历史、"我的作品"页（按状态筛选）、结果大图预览；刷新后从后端恢复，未完成的任务继续跟踪。
- 账号与个人记录、退出和切换账号时的清理。
- 测试、契约样例、冒烟脚本、人工清单、CI、Docker Compose 一键启动。

已知限制：

- **只按单实例设计**。重启边界：停机时线程池最多等待 15 秒；仍在执行的任务在下次启动时被标记为"失败 · 当时的阶段"（`INTERRUPTED`，原因"服务重启，任务执行被中断，请重新提交"）；排队中（PENDING）的任务在启动后自动重新执行。多实例需要租约和心跳，没有实现。
- 失败的任务没有自动重试或断点续跑，需要重新提交。
- 中间文件会清理，但历史素材和结果图没有过期清理策略。
- "模拟生成"是确定性的本地图形拼接，不调用真实 AI。
- CSRF 依靠同源、SameSite=Lax 和只接受 JSON / multipart 的写接口，没有额外的 CSRF 令牌。
- 前端没有浏览器端到端测试，用组件测试、API 冒烟和人工清单代替；没有压力测试。
- 没有 Docker 的环境里，Testcontainers 集成测试会被跳过（CI 中会真正执行）。
- 经过前端（:3000）直接上传超过 10MB 的请求时，Tomcat 返回 413 后会主动断开连接（Tomcat 对 413 的固定行为），Next 的转发会等到 30 秒超时才返回 500；直连后端（:8080）会正确返回 413 `FILE_TOO_LARGE`。正常使用时，前端会先按模板上限（最大 5MB）拦下文件，不会走到这里；10MB 以内的上传经过转发是完整的（已用 9.5MB 文件校验过字节一致）。

实际投入：**4h**

## 13. 部署与回滚

- **部署**：
  1. 构建镜像并用 commit SHA 打标签，例如 `IMAGE_TAG=$(git rev-parse --short HEAD) docker compose build`。
  2. 在目标机器上设置同样的 `IMAGE_TAG`，执行 `docker compose up -d`。后端启动时 Flyway 自动迁移数据库。
- **回滚**：
  - 把 `IMAGE_TAG` 改回上一个版本，再执行 `docker compose up -d`。
  - 数据库迁移只向前，并保持向后兼容；破坏性变更拆成多次发布。升级前先用 `mysqldump` 备份。
- **生产环境必须设置**：`DEV_API_ENABLED=false`；使用 https 时 `SESSION_COOKIE_SECURE=true`；真实的数据库密码（通过 `.env` 或密钥管理传入，不进仓库）。

## 14. AI 使用说明

这个项目我用了两个 AI 编程助手：**Claude**（Claude Code）负责需求分析、规格、验证资产、前端、Compose、CI 和联调；**Codex** 负责后端。代码基本都是 AI 生成的，我的精力主要放在拆任务、给上下文、每个阶段把关和最后的验收上。

**拆任务。** 拿到题目后，我先让 Claude 做需求分析，把题目要求整理成 R-01 到 R-14 的需求点，再展开成 `spec/` 下的一套规格：架构、接口契约、数据、前端设计、验证方案和任务清单。分工是我定的：前端交给 Claude，后端交给 Codex，目标一天做完。我也提过，有必要的话可以加 RocketMQ 和 Redis。Claude 分析后建议不加，我同意了：单实例、一天的工期，它们只会增加部署和排错的成本；改为在投递的地方留一个 `TaskDispatcher` 接口，以后接消息队列只需要加一个实现。具体工作拆成三条线：I0–I5（仓库和验证资产、Compose、CI、联调、审查后端、README）、B0–B7（后端）、F0–F7（前端），每个阶段写明要做什么、达到什么门槛才算完成（`spec/06` §3）。前后端只通过 `spec/03-api.md` 和 `verify/fixtures/` 里的契约样例对接，所以两边可以同时开工。

**给上下文。** 两个 AI 读的是同一套 spec。我尽量不在聊天里口头补充需求，这样两边的理解一致，出了问题也能对着文档查。交给 Codex 的启动提示词就在 `spec/README.md` 里，一共 17 条：先读完 spec，再按 B0–B7 的顺序做；只改自己的目录，只 `git add` 自己的路径；接口必须和契约完全一致，觉得契约有问题就先停下来说明，不能自己改；六条红线（比如提交接口不能等待任何步骤、查询只读、终态不能改回）；每个阶段测试和冒烟都通过，才能进入下一阶段；还有本机环境的提醒（同时装着 JDK 17 和 21、Maven Wrapper 下载慢）。Claude 写前端时遵守同样的规则。规格没覆盖的细节，两边各自记进 `DECISIONS.md`。

**生成和修改代码。** 一个阶段一个提交，提交信息以阶段号开头，`git log` 里能看到整个推进过程。I0 的规格和验证资产在后端开工前就写好了，但等到开始写前端时才第一次提交，所以在 `git log` 里排在 B0–B7 之后。核心逻辑测试先行：后端 B5 先写 `TaskPipelineTest` 和 `TaskStateGuardIT`，前端 F5 先写任务跟踪的测试，都是确认测试失败之后再写实现。后端的问题由 Claude 写成修复提示词，我转给 Codex；前端的问题由 Claude 直接改。需求有变化时，先改契约和检查，再改实现。

**验证。** 验证资产比业务代码先写：I0 阶段就有了契约样例、冒烟脚本 `verify/smoke.mjs` 和人工清单 `verify/CHECKLIST.md`。为了确认冒烟脚本本身可靠，Claude 还写了一个临时的假后端，在里面注入 14 种典型缺陷，脚本每一种都能查出来。Codex 写完后端后，Claude 独立复核了一遍：跑全部测试（59 项）和冒烟（69 项），再对照红线逐条看代码。前端每个阶段都跑 lint、typecheck 和 Vitest，并在浏览器里实际操作。最后从零构建（`docker compose down -v`，再 `docker compose up --build --wait`）并跑冒烟。从零构建和冒烟我自己也跑了一遍，并按清单走查。

**一个具体的例子：切换账号后看到了上一个用户的结果图。** 联调时，Claude 在浏览器里按 S11 测切换账号：先用 demo 看一张结果图，切换到 alice 后，在地址栏打开 demo 那个任务的结果地址。这里应该是 404，页面却显示出了 demo 的图。绕过缓存再请求一次，服务端返回的确实是 404，说明权限检查没有问题，图片来自浏览器缓存。原因是私有图片的响应带了 `Cache-Control: private, max-age=86400`，允许浏览器缓存一天，却没有带 `Vary: Cookie`，于是同一个 URL 的缓存在不同的登录会话之间被复用了。冒烟脚本和集成测试都不经过浏览器缓存，所以之前一直没有暴露。

修的时候先改契约：在 `spec/03-api.md` 里写明私有图片必须带 `Vary: Cookie`，并给冒烟脚本加上对应的检查（`e52de1b`）。然后 Claude 把复现步骤、根因和要求写成提示词，我转给 Codex。Codex 先在 `MaterialUploadIT` 和 `TaskFlowIT` 里加上对这两个响应头的断言，确认修复前会失败，再改两个图片接口（B8，`9fd1946`），并把经过记进 `backend/DECISIONS.md` 的问题记录。验证分三步：后端 59 项测试全部通过；Claude 在浏览器里把切换账号重走一遍，alice 看不到 demo 的图了；最后从零构建，经过 :3000 的 69 项冒烟全部通过，我自己也从零跑了一遍。修复前已经缓存的图片还可能被复用一段时间，所以 `CHECKLIST.md` 里加了一条提醒：走查前先清缓存，或者用无痕窗口。这件事让我体会到：自动化测试写得再全，也要在真实的浏览器里走一遍。

**其他几个问题：**

- 64 个中文字符的密码，UTF-8 编码后有 192 字节，超过 BCrypt 72 字节的上限，注册时返回 500。Codex 在 B6 补边界测试时发现，先写复现测试再修。`backend/DECISIONS.md` 的问题记录里还有几条。
- 经过 Next 转发上传超过 10MB 的文件时，Tomcat 返回 413 后会断开连接，Next 要等到 30 秒超时才返回 500。评估后没有修：前端会先按模板上限（最大 5MB）拦下文件，正常使用走不到这里，所以写进了已知限制。
- AI 也会犯低级错误。有一次 Claude 用 Windows PowerShell 5.1 改文件，把 UTF-8 的中文写成了乱码，检查改动时发现，用 git 还原后换了编辑方式。
- 最后走查时，Claude 帮我测清单里的命令，发现 PowerShell 的 `Invoke-RestMethod` 访问 `localhost:8080` 会卡到超时：它会先尝试 IPv6，而在这台机器上，经 IPv6 访问 Docker 映射出来的端口会一直挂着。于是把文档里的 PowerShell 命令改成了 `127.0.0.1`。

**我自己做的部分：** 定分工和节奏，确认方案；准备本机环境（JDK 21、Docker Desktop）；在两个 AI 之间传递提示词；看每个阶段的结果，决定是否进入下一阶段；最后自己从零构建、跑冒烟、按清单走查，确认没问题后再提交。

## 15. 复用来源

- 脚手架：`create-next-app@16.4.6`（前端）、Spring Initializr（后端，Spring Boot 4.1.2）。
- 开源依赖：见第 2 节，均通过 npm / Maven 引入，按各自的许可证使用；图标来自 lucide-react（ISC）。
- 图片：模板封面和 `samples/` 下的样例图都由 `scripts/GenerateDemoAssets.java` 生成，没有使用第三方图片或字体。

---

验收 commit：**main 分支的最新提交**。最后一次改代码的提交是 `9fd1946`（B8：私有图片加 `Vary: Cookie`），之后只改了文档；从零构建、测试和冒烟都在它之后重新跑过。
