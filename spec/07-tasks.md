# 07 分工、顺序与任务清单

## 1. 执行顺序

| 段 | 谁 | 内容 | 产出 | 约用时 |
|---|---|---|---|---|
| ① | 你 | 读 spec/README、03、06；准备 JDK 21，确认新开的终端里 `java -version` 显示 21 | 规格确认、环境就绪 | 20 分钟 |
| ② | Claude | I0：初始化仓库，写好验证资产（夹具、冒烟脚本、人工清单）。**不写前端** | 仓库骨架、验证资产、首次提交 | 40 分钟 |
| ③ | 你 | 打开 Codex，粘贴 spec/README 里的启动提示词 | Codex 开工 | 2 分钟 |
| ④ | Codex ∥ Claude | 后端 B0–B7 与前端 F0–F7 并行，按 06 §3 的门槛推进 | 两边各自能运行、测试通过 | 3–4 小时 |
| ⑤ | Claude | I1–I3：补全 compose 和 CI，从零构建，按 06 §8 联调 | 一键启动可用，冒烟和人工清单都通过 | 1 小时 |
| ⑥ | Claude → Codex | I4：审查后端，把问题写成提示词，由你转给 Codex | 修复提交 | 30 分钟 |
| ⑦ | Claude + 你 | I5：Claude 起草 README；你走查 CHECKLIST、写个人部分、选定验收 commit | 可以交付 | 1 小时 |

并行期间的对接点：

- **何时连真接口**：后端过了 B3 门槛（账号可用）之后，前端开始连真接口调试；在这之前，前端用夹具做的假响应开发。
- **契约有问题**：先停下来，由你转达给另一方；Claude 同时修改 03 和夹具，然后双方再改代码。
- **进度**：通过提交信息体现（例如 `B5: ...`、`F4: ...`）。并行期间双方都不改 spec/；全部完成后，由 Claude 统一勾选本文件。

## 2. 协作规则

| 路径 | 归属 | 规则 |
|---|---|---|
| `backend/`、`scripts/GenerateDemoAssets.java`、`samples/` | Codex | 只 `git add backend scripts/GenerateDemoAssets.java samples` |
| `frontend/` | Claude | 只 `git add frontend` |
| `verify/` | Claude | I0 写好；契约变更时随 03 一起改 |
| `docker-compose.yml`、`.env.example`、`.github/`、`.gitignore`、`.gitattributes`、`README.md` | Claude | 在 I0 和 I1–I5 阶段修改，并行期间双方都不改 |
| `spec/` | Claude | 契约变更按上面的流程走 |

- 禁止 `git add -A` 和 `git commit -a`：会把对方写到一半的文件一起提交。
- 两边同时提交时可能遇到 `index.lock`，等几秒重试即可。
- 规格之外的决定，各自记到 `backend/DECISIONS.md` 和 `frontend/DECISIONS.md`，I5 时合并进 README。

## 3. I0 仓库初始化与验证资产（Claude，在编码之前）

- [ ] `git init`，默认分支为 main
- [ ] 根目录 `.gitignore`：node_modules/、.next/、coverage/、backend/target/、data/、backend/data/、.env、*.log、.idea/、.vscode/、*.iml
- [ ] `.gitattributes`：默认 LF；`*.cmd`、`*.bat` 用 CRLF；图片标记为 binary
- [ ] `.env.example`（内容见 §8，全部是无害的示例值）
- [ ] `docker-compose.yml`：只有 mysql 服务（mysql:8.4；宿主机端口 3307；utf8mb4；UTC 时区；健康检查；数据卷）
- [ ] `verify/fixtures/` 下 13 个夹具（06 §6.1），与 03 §2 逐字段核对
- [ ] `verify/smoke.mjs`：包含 06 §7.2 的五个段，支持 `--only` 和 `--self-check`
- [ ] `verify/CHECKLIST.md`：06 §8.1 的 S01–S13 和 §8.2 的走查项，每项留"结果 / 日期 / 备注"三列
- [ ] 门槛：`node verify/smoke.mjs --self-check` 通过
- [ ] 首次提交：spec 和上面这些文件（先征得你同意）

## 4. 后端 B0–B7（Codex）

### B0 骨架
- [ ] 用 Spring Initializr 生成：Boot 4.1.x、Java 21、Maven、group `com.xiaoying`、artifact `studio`、包名 `com.xiaoying.studio`
- [ ] 依赖按 02 §9；`application.yml` 按 02 §8；`application-local.yml` 打开开发接口
- [ ] `ApiErrorResponse`、`ErrorCode`、`GlobalExceptionHandler`（覆盖校验失败、上传超限返回 413、404、500）
- [ ] `Clock` bean；actuator health
- [ ] 门槛：见 06 §3 的 B0

### B1 数据与示例图
- [ ] `V1__schema.sql`、`V2__seed.sql`（04 §2–3；BCrypt 哈希现场计算）
- [ ] `scripts/GenerateDemoAssets.java`：生成 9 张封面和 6 个样例文件；写 `samples/README.md`
- [ ] 门槛：B1

### B2 模板
- [ ] 接口 5、6、7，以及对应的 mapper XML
- [ ] `TemplateIT`
- [ ] 门槛：B2（包括 `smoke --only templates`）

### B3 账号
- [ ] 接口 1–4；`AuthInterceptor`、`@LoginUser`、`X-User-Id` 头、Cookie 属性
- [ ] `AuthIT`、`SeedPasswordTest`
- [ ] 门槛：B3

### B4 素材
- [ ] 接口 8、9；`ImageSniffer`、`FileStorage`（原子写入、防路径穿越）
- [ ] `MaterialUploadIT`、`ImageSnifferTest`
- [ ] 门槛：B4

### B5 任务引擎（核心，测试先行）
- [ ] **先写** `TaskPipelineTest`、`TaskStateGuardIT`，确认它们失败
- [ ] `TaskStateStore` / `MyBatisTaskStateStore`（守卫 SQL 见 04 §4）
- [ ] `TaskPipeline`、`StepSimulator`、三个 Step、`TaskRunner`
- [ ] `TaskSubmissionService`（校验顺序见 03 §4.4；在事务里建任务；生成模拟快照；发布事件）
- [ ] `TaskEnqueueListener`（AFTER_COMMIT）、`TaskDispatcher` / `LocalTaskDispatcher`、线程池（02 §5.2）
- [ ] `TaskRecovery`（02 §5.6）
- [ ] 接口 10–13；列表查询避免 N+1（04 §6）
- [ ] `SimulationSettings`；开发接口 14–16（`@ConditionalOnProperty`）；`QueryOutageInterceptor`
- [ ] `Idempotency-Key`：撞上唯一键时返回已有任务
- [ ] 日志：MDC 放 taskId；输出 STEP_START / STEP_END / STEP_FAILED
- [ ] 其余测试：`StepSimulatorTest`、`SimulationSettingsTest`、`TaskSubmissionIT`、`TaskFlowIT`、`TaskRecoveryIT`
- [ ] 门槛：B5（`smoke http://localhost:8080` 全部通过）

### B6 补全测试与自测
- [ ] 06 §4 的全部用例（`ContractShapeIT` 是 P1）
- [ ] 用 curl 自测 S03、S04、S05、S09，记录写进 `backend/DECISIONS.md`

### B7 容器
- [ ] `backend/Dockerfile`：
  - 构建阶段用 `maven:3.9-eclipse-temurin-21`：先拷 pom 预取依赖，再 `mvn -B -DskipTests package`
  - 运行阶段用 `eclipse-temurin:21-jre`：非 root 用户；`/data` 目录归该用户；`ENV TZ=UTC`；`EXPOSE 8080`
- [ ] `backend/.dockerignore`
- [ ] 在 `DECISIONS.md` 里写明运行镜像里有没有 `curl`（compose 的健康检查要用）

## 5. 前端 F0–F7（Claude，在你确认、I0 完成之后）

### F0 骨架
- [ ] `npx create-next-app@16.4.6 frontend`：TypeScript、ESLint、Tailwind、App Router、`src/`、别名 `@/*`
- [ ] 脚本：lint / typecheck / test / build；`@types/node` 改为 `^24`
- [ ] 依赖：@tanstack/react-query、lucide-react
- [ ] 开发依赖：vitest、@vitejs/plugin-react、jsdom、@testing-library/react、@testing-library/user-event、@testing-library/jest-dom
- [ ] `next.config.ts`（05 §12）、`vitest.config.ts`、`src/test/setup.ts`、`fakeApi.ts`
- [ ] 门槛：F0

### F1 数据层
- [ ] `types.ts`（照抄 03 §2）、`validate.ts`、`client.ts`、`endpoints.ts`、`upload.ts`、`query-keys.ts`，以及 QueryClient 的默认值
- [ ] `apiClient.test.ts`、`fixtures.test.ts`
- [ ] 门槛：F1

### F2 身份与布局
- [ ] `AuthProvider`、`proxy.ts`、登录 / 注册页（显示演示账号）、`AppHeader`、`AccountDialog`，以及退出和切换账号时的清理流程

### F3 模板列表
- [ ] `CategoryNav`（用 URL 参数）、`TemplateGrid`、`TemplateCard`；加载中、空数据、出错三种状态

### F4 详情与上传
- [ ] 详情页的加载中、404、出错、成功四种状态；封面区；素材要求说明
- [ ] `uploadSlotsReducer`、`UploadSlot`、`validateFile`，以及 XHR 上传与中止
- [ ] 提交按钮状态机；`Idempotency-Key`
- [ ] `uploadSlotsReducer.test.ts`、`validateFile.test.ts`
- [ ] 门槛：F2–F4

### F5 任务跟踪（测试先行）
- [ ] **先写** `taskView`、`mergeTask`、`taskTracking`、`createPanel` 的测试，确认它们失败
- [ ] `deriveTaskView`、`mergeTask`、`useTaskList`、`useTrackedTask`
- [ ] `HistoryPanel`（详情页右栏）、`TaskCard`、`StageSteps`、`ResultPreviewDialog`
- [ ] `/history` 页（带状态筛选）
- [ ] 门槛：F5

### F6 补全测试
- [ ] 06 §5 的全部用例（`authReset` 是 P1）

### F7 容器与调试页
- [ ] `frontend/Dockerfile`：基于 node:24-alpine，分三个阶段；build arg `BACKEND_INTERNAL_URL`；standalone 输出；非 root 用户
- [ ] `frontend/.dockerignore`
- [ ] `/dev` 调试页（P1）

## 6. 联调与交付 I1–I5（Claude）

### I1 Compose
- [ ] 加入 backend 服务：
  - 依赖 mysql 健康
  - 挂载 `/data` 卷
  - 环境变量按 02 §8
  - `stop_grace_period: 20s`
  - 健康检查 `/actuator/health`
- [ ] 加入 frontend 服务：build arg `BACKEND_INTERNAL_URL=http://backend:8080`；依赖 backend 健康
- [ ] 所有变量都有默认值，没有 .env 也能启动

### I2 CI
- [ ] `.github/workflows/ci.yml`，包含 frontend、backend、compose 三个 job（06 §9）

### I3 联调
- [ ] 执行 `docker compose down -v && docker compose up --build --wait`，从零启动，三个服务都是 healthy
- [ ] `node verify/smoke.mjs`（经 :3000）全部通过
- [ ] 按 CHECKLIST 走完 S01–S13 和走查项。发现问题按 06 §11 处理：后端问题写成提示词交给 Codex

### I4 审查后端
- [ ] 按 01 §4 的红线逐条对照代码：事务边界、守卫 SQL、查询只读、失败中断、用户隔离、恢复逻辑
- [ ] 把问题写成可以直接复制的提示词

### I5 README
- [ ] Claude 起草技术部分，你补个人部分（§7）

## 7. README 必须包含的内容

| # | 内容 | 来源 |
|---|---|---|
| 1 | 技术版本、项目结构、构建 / 测试 / 启动命令、前后端和数据库怎么连接 | 02 §1–3、§8 |
| 2 | 配置项及不含真实凭据的示例、数据库初始化（Flyway）、模拟数据和示例图的准备方式 | 02 §8、04 §3、§8 |
| 3 | 主要接口及字段、任务状态和阶段、后台执行方式 | 03、02 §5 |
| 4 | 如何演示：成功、指定阶段失败、调整耗时、多任务、刷新恢复 | 06 §8.1 |
| 5 | 用户身份与个人记录的设计和演示方法 | 02 §7、S11 |
| 6 | 已完成 / 未完成、已知限制、实际投入（包括重启恢复的边界） | 你 + DECISIONS + 06 §12 |
| 7 | 部署与回滚的基本步骤 | 见下方 |
| 8 | AI 使用说明：怎么拆任务、怎么给上下文、怎么生成和修改代码、怎么验证、怎么修正问题；举一个具体例子 | **你来写** |
| 9 | 用到的脚手架、开源库、素材的来源和复用范围 | create-next-app、Spring Initializr、各依赖；示例图由脚本生成 |
| — | 测试与验证方式（各层测试、冒烟脚本、人工清单） | 06 |
| — | 验收 commit | 你 |

部署与回滚：

- **部署**：
  1. 构建镜像，用 commit SHA 打 tag。
  2. 在目标机器上设置 `IMAGE_TAG`。
  3. 执行 `docker compose up -d`。后端启动时 Flyway 会自动迁移数据库。
- **回滚**：
  - 把 `IMAGE_TAG` 改回上一个版本，再执行 `docker compose up -d`。
  - 数据库迁移只向前、并保持向后兼容；破坏性的变更拆成多次发布。
  - 升级前先用 `mysqldump` 备份。
- **生产环境必须设置**：`DEV_API_ENABLED=false`；用 https 时设 `SESSION_COOKIE_SECURE=true`；使用真实的数据库密码。

## 8. `.env.example` 的内容

```dotenv
# 数据库（示例值，不是真实凭据）
DB_NAME=material_studio
DB_USER=studio
DB_PASSWORD=studio_pass
DB_ROOT_PASSWORD=root_pass
# 宿主机端口
FRONTEND_HOST_PORT=3000
BACKEND_HOST_PORT=8080
MYSQL_HOST_PORT=3307
# 任务执行与模拟
TASK_WORKERS=2
SIM_FAIL_STAGE=NONE
SIM_DELAY_MATERIAL_CHECK_MS=1500
SIM_DELAY_GENERATING_MS=4000
SIM_DELAY_RESULT_ASSEMBLY_MS=1500
DEV_API_ENABLED=true
```

## 9. 提交前检查

- [ ] `docker compose down -v && docker compose up --build` 能从零启动
- [ ] `node verify/smoke.mjs` 全部通过
- [ ] CI 三个 job 全绿
- [ ] CHECKLIST 的 S01–S13 和走查项全部打勾（你亲手走）
- [ ] 仓库里没有 `.env`、`node_modules`、`target`、`data`，也没有真实密钥
- [ ] README 写的版本号与 lock 文件、pom 一致
- [ ] 已按保密要求决定 spec/ 是否保留
- [ ] 回复里写明验收 commit 的 SHA

## 10. 可选扩展（默认不做）

- RocketMQ 派发器：以 compose profile `mq` 的方式加入，默认关闭（见 01 §5）
- Redis 存储会话
- 用 SSE 推送代替轮询
- 多实例：租约 + 心跳回收
- 失败任务重新制作
