# 02 架构

## 1. 技术栈与版本

版本于 2026-11-10 通过 endoflife.date、npm、Maven Central 核实。"Boot 管理"指版本由 Spring Boot 的依赖管理决定，pom 里不写版本号。

| 组件 | 版本 | 说明 |
|---|---|---|
| Java | 21 LTS（镜像和 CI 用 Temurin） | 本机已装 JDK 21，JAVA_HOME 指向它；机器上还有 JDK 17，执行 java 前先看 `java -version`。Boot 4.1 最低要求 17 |
| Spring Boot | 4.1.x（当时最新 4.1.2） | 3.5 的开源支持已在 2026-06-30 结束；4.0 在 2026-12-31 结束 |
| Spring Framework | 7.0.x | Boot 管理 |
| mybatis-spring-boot-starter | 4.1.0 | 基于 Spring Boot 4.1.0 构建，内含 MyBatis 3.5.19 |
| MySQL | 8.4 LTS，镜像 `mysql:8.4` | 支持到 2029-04 |
| MySQL Connector/J | 9.7.x，坐标 `com.mysql:mysql-connector-j` | Boot 管理 |
| Flyway | 12.4.x | Boot 管理；需要 `spring-boot-starter-flyway` 和 `flyway-mysql` |
| spring-security-crypto | — | Boot 管理；只用其中的 BCrypt |
| JUnit Jupiter / Mockito / Awaitility | 6.0.x / 5.23.x / 4.3.x | Boot 管理 |
| Testcontainers | 2.0.x | Boot 管理；模块名是 `testcontainers-mysql`、`testcontainers-junit-jupiter` |
| Node.js | 24 LTS，镜像 `node:24-alpine` | 本机是 24.15 |
| Next.js | 16.4.x | 用 `create-next-app@16.4.6` 生成 |
| React | 19.x | 用脚手架生成的版本 |
| TypeScript | 5.9.x（`^5`） | **不要升到 7**：typescript-eslint 只支持 `<6.1`，升了 lint 会报错 |
| ESLint | 9.x（`^9`），配 eslint-config-next 16.4.x | Next 16 已删除 `next lint`，直接运行 `eslint` |
| Tailwind CSS | 4.x | 脚手架自带 |
| TanStack Query | 5.x | 管理服务端状态 |
| lucide-react | 1.x | 图标 |
| Vitest | 5.x，配 @testing-library/react 16 和 jsdom | 前端测试 |
| 镜像 | `maven:3.9-eclipse-temurin-21`（构建）、`eclipse-temurin:21-jre`（运行） | |

## 2. 仓库结构与归属

```
fullstack-material-studio/
├─ backend/                         Codex
│  ├─ pom.xml、mvnw、mvnw.cmd、.mvn/
│  ├─ Dockerfile、.dockerignore
│  ├─ DECISIONS.md                  实现中的决定、自测记录、问题记录
│  └─ src/
│     ├─ main/java/com/xiaoying/studio/…
│     ├─ main/resources/
│     │  ├─ application.yml、application-local.yml
│     │  ├─ db/migration/V1__schema.sql、V2__seed.sql
│     │  ├─ mapper/*.xml
│     │  └─ static/demo/covers/*.png
│     └─ test/java/com/xiaoying/studio/…
├─ frontend/                        Claude
│  ├─ package.json、package-lock.json、next.config.ts、tsconfig.json
│  ├─ eslint.config.mjs、vitest.config.ts、postcss.config.mjs
│  ├─ Dockerfile、.dockerignore、DECISIONS.md
│  └─ src/…（见 05 §3）
├─ verify/                          Claude，I0 写好，编码前就位
│  ├─ fixtures/*.json               契约样例：前端测试拿来当假响应，冒烟脚本拿来比对字段
│  ├─ smoke.mjs                     API 冒烟验收（Node 24，无依赖）
│  ├─ CHECKLIST.md                  人工验收清单（S01–S13）
│  └─ README.md                     这三样东西的说明和用法
├─ scripts/GenerateDemoAssets.java  Codex：生成封面和样例图（只用 JDK）
├─ samples/                         Codex：演示上传用的图片，以及说明
├─ docker-compose.yml               Claude：I0 只有 mysql，I1 补全
├─ .env.example                     Claude
├─ .github/workflows/ci.yml         Claude
├─ .gitignore、.gitattributes       Claude
├─ README.md                        Claude 起草，你补个人部分
└─ spec/                            Claude
```

## 3. 运行拓扑

```
             只访问 :3000（同源，自动带 HttpOnly Cookie）
 浏览器 ───────────────────────────────► Next.js :3000
                                            │ rewrites：/api/*、/demo/*
                                            ▼
                                      Spring Boot :8080 ──► MySQL 8.4 :3306
                                            │
                                            └──► /data 卷：materials/ work/ results/
```

| 服务 | 容器内端口 | 宿主机端口（默认） | 说明 |
|---|---|---|---|
| frontend | 3000 | 3000 | 用户入口 |
| backend | 8080 | 8080 | 也暴露出来，方便用 curl 调开发接口、直连跑冒烟脚本 |
| mysql | 3306 | 3307 | 避开本机已有的 MySQL；开发期间后端连这个 |

## 4. 关键流程

### 4.1 上传

1. 前端：选择文件 → 按模板要求校验类型和大小 → 用 XHR 发 `POST /api/materials`（带 `file` 和 `templateId`），显示进度。
2. 后端：
   1. 检查全局上限（10MB）
   2. 读文件头判断真实类型（只认 JPEG、PNG）
   3. 检查模板允许的类型和大小上限
   4. 写入 `materials/{userId}/{yyyyMM}/{uuid}.{ext}`：先写临时文件，再改名
   5. 插入一条 `material` 记录
   6. 返回 201，附素材 ID 和预览地址

### 4.2 提交

1. 前端发 `POST /api/tasks {templateId, materialIds}`，按钮进入"提交中"。
2. 后端同步校验，依次检查：
   1. 模板存在且已上架
   2. 素材数量符合要求
   3. 素材没有重复
   4. 素材都属于当前用户
   5. 素材类型被模板接受
   6. 素材大小不超过模板上限

   任一项不通过就直接返回 4xx，不建任务。
3. 在一个事务里插入 `generation_task`（PENDING，同时写入模拟配置快照）和 `generation_task_material`，然后发布 `TaskCreatedEvent`。
4. **事务提交之后**，监听器调用 `TaskDispatcher.dispatch(taskId)`，任务进入线程池队列。
5. 返回 202，附任务快照和 `Location` 头。

### 4.3 执行

worker 线程先抢占任务（PENDING → PROCESSING），再依次执行三步，最后变成 SUCCEEDED 或 FAILED。详见 §5。

### 4.4 查询

`GET /api/tasks` 和 `GET /api/tasks/{id}` 只做 SELECT：不调用任何推进逻辑，也不写任何表。

## 5. 后端异步执行模型

### 5.1 组件

| 组件 | 职责 |
|---|---|
| `TaskSubmissionService` | 同步校验；在事务里建任务和素材关联；生成模拟快照；发布 `TaskCreatedEvent` |
| `TaskEnqueueListener` | `@TransactionalEventListener(phase = AFTER_COMMIT)`，调用 dispatcher |
| `TaskDispatcher`（接口） | `void dispatch(long taskId)`。目前只有一个实现 `LocalTaskDispatcher`：提交到线程池 |
| `TaskRunner` | 抢占任务 → 加载上下文（模板、素材、模拟快照）→ 交给流水线 |
| `TaskPipeline` | 按固定顺序执行三步；每步前后写状态；处理失败 |
| `TaskStep`（接口） | `TaskStage stage()`；`String execute(TaskContext ctx) throws StepFailedException`，返回一句结果摘要 |
| `MaterialCheckStep`、`GenerationStep`、`ResultAssemblyStep` | 三步各自的实际工作 |
| `StepSimulator` | 每步开始前按快照 sleep；如果快照里的失败阶段就是当前阶段，抛出 `StepFailedException(SIMULATED_FAILURE)` |
| `TaskStateStore`（接口） | `claim`、`enterStage`、`completeStep`、`failStepAndTask`、`succeed`。流水线只依赖这个接口，单元测试用内存实现 |
| `TaskRecovery` | 启动时处理上次遗留的任务（§5.6） |
| `SimulationSettings` | 运行时的模拟配置，提交任务时生成快照 |

### 5.2 线程池

- `ThreadPoolTaskExecutor`：核心线程数等于最大线程数，都取 `TASK_WORKERS`（默认 2）；队列无界；线程名前缀 `task-worker-`。
- `waitForTasksToCompleteOnShutdown=true`，`awaitTerminationSeconds=15`；配合 `server.shutdown=graceful`。
- 队列里只放 taskId，数据库才是事实来源。进程退出、队列丢了也没关系，启动时会从数据库重新派发 PENDING 的任务。

### 5.3 抢占与流水线

```java
// TaskRunner.run(taskId)，在 worker 线程里执行
if (!store.claim(taskId)) return;              // PENDING → PROCESSING；抢不到说明已经被处理过
TaskContext ctx = contextLoader.load(taskId);   // 模板、素材（按 slot 顺序）、模拟快照
pipeline.execute(ctx);

// TaskPipeline.execute(ctx)
for (TaskStep step : steps) {                   // 固定顺序：素材检查 → 模拟生成 → 结果整理
    TaskStage stage = step.stage();
    if (!store.enterStage(ctx.taskId(), stage)) return;    // 守卫失败：任务已经不是 PROCESSING
    try {
        simulator.beforeStep(ctx.plan(), stage);            // sleep；命中失败阶段就抛 SIMULATED_FAILURE
        String summary = step.execute(ctx);                 // 实际工作；业务失败抛 StepFailedException
        store.completeStep(ctx.taskId(), stage, summary);
    } catch (StepFailedException e) {
        store.failStepAndTask(ctx.taskId(), stage, e.code(), e.getMessage());
        return;                                             // 后续步骤不执行
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();                 // 停机：保持 PROCESSING，交给下次启动的恢复逻辑
        return;
    } catch (RuntimeException e) {
        log.error("task {} stage {} unexpected error", ctx.taskId(), stage, e);
        store.failStepAndTask(ctx.taskId(), stage, "INTERNAL_ERROR", "系统内部错误，请稍后重试");
        return;
    }
}
store.succeed(ctx.taskId(), ctx.resultKey());
```

要点：

- `TaskStateStore` 的每个方法都是一个独立的短事务。`enterStage` 在同一个事务里先更新任务（带守卫），确实更新到 1 行之后才插入步骤记录。
- 守卫更新返回 0 行，说明任务已经不在预期的状态（比如已被恢复逻辑标记为失败）。这时记一条 warn 日志并停止，不再写任何状态。
- 模拟失败放在实际工作**之前**，避免留下半成品文件。

### 5.4 三步各做什么

| 阶段 | 实际工作 | 可能的失败码 |
|---|---|---|
| `MATERIAL_CHECK` 素材检查 | 逐张检查：文件存在；磁盘大小等于记录的大小；文件头和记录的 MIME 一致；ImageIO 能解码；宽和高都不小于 `MATERIAL_MIN_DIMENSION`（默认 64）。摘要示例："已检查 2 张图片" | `MATERIAL_FILE_MISSING`、`MATERIAL_CORRUPTED`、`MATERIAL_RESOLUTION_TOO_LOW` |
| `GENERATING` 模拟生成 | 把用户的图片按版式画到 720×960 的画布上（版式见下方）。背景色由模板 ID 决定。**不画文字**，因为容器里可能没有字体。结果写到 `work/{taskId}/generated.png` | `GENERATION_FAILED` |
| `RESULT_ASSEMBLY` 结果整理 | 确认中间图存在 → 转成 JPEG（PNG 的透明区域先铺底色），写到 `results/{userId}/{taskId}.jpg` → 删除 `work/{taskId}/` → 把 result_key 交给 `succeed` | `RESULT_WRITE_FAILED` |

模拟生成的版式：

- 1 张：居中铺满，四周留边
- 2 张：上下各占一半
- 3 张：上面一张大图，下面两张小图
- 4 张：2×2

上传时只做便宜的校验（大小、文件头）。解码和分辨率检查放到异步的素材检查步骤里，相当于真实产品里比较重的检查（例如人脸检测）。这样 `samples/tiny-32.png` 能上传成功，但会在素材检查这一步失败，可以演示一次真实的、非注入的失败。

### 5.5 失败处理规则

| 情况 | 步骤记录 | 任务 | 后续步骤 |
|---|---|---|---|
| `StepFailedException`（包括模拟失败） | 记为 FAILED，附原因 | 记为 FAILED，保存 failedStage、errorCode、errorMessage | 不执行 |
| 未预期的 `RuntimeException` | 记为 FAILED | 记为 FAILED，errorCode 为 `INTERNAL_ERROR`，原因为"系统内部错误，请稍后重试"；日志打印堆栈 | 不执行 |
| `InterruptedException`（停机） | 保持 RUNNING | 保持 PROCESSING，由下次启动处理 | 不执行 |
| 守卫更新返回 0 行 | 不写 | 不写 | 不执行 |

错误信息是给用户看的，用中文写清楚：哪一步、哪张图、什么原因。

### 5.6 重启与停机（假设只有一个实例）

- **停机**：优雅关闭最多等 15 秒；还没跑完的任务会被中断，状态保持 PROCESSING。
- **启动**（`ApplicationReadyEvent`）：
  1. 所有 PROCESSING 的任务改为 FAILED：`errorCode=INTERRUPTED`，`errorMessage="服务重启，任务执行被中断，请重新提交"`，`failedStage` 取当时的 stage。对应的 RUNNING 步骤也改为 FAILED。
  2. 所有 PENDING 的任务按 id 顺序重新派发。
- 多实例需要租约和心跳（worker_id + heartbeat_at），不在本题范围内，README 里说明。

### 5.7 并发与扩展

- 抢占用的是 CAS 式更新：即使同一个 taskId 被派发两次，任务也只会执行一次。
- **换成 RocketMQ 的做法**：
  - 新增 `RocketMqTaskDispatcher`，负责发送 taskId。
  - 新增一个消费者，收到消息后调用 `TaskRunner.run`。
  - 抢占机制保证在"至少一次"投递下不会重复执行；数据库仍是事实来源。
- **想支持多实例**：去掉启动时"把 PROCESSING 全部标为失败"的做法，改成租约超时后才回收。

### 5.8 日志

- 用 MDC 放 `taskId`。
- 每一步打印 `STEP_START`、`STEP_END`（含耗时）、`STEP_FAILED`（含错误码）。演示时用 `docker compose logs -f backend` 就能直接看到三步的边界。

## 6. 模拟控制

| 配置 | 默认值 | 环境变量 | 开发接口字段 |
|---|---|---|---|
| 失败阶段 | NONE | `SIM_FAIL_STAGE` | `failStage` |
| 素材检查耗时 | 1500 ms | `SIM_DELAY_MATERIAL_CHECK_MS` | `delaysMs.MATERIAL_CHECK` |
| 模拟生成耗时 | 4000 ms | `SIM_DELAY_GENERATING_MS` | `delaysMs.GENERATING` |
| 结果整理耗时 | 1500 ms | `SIM_DELAY_RESULT_ASSEMBLY_MS` | `delaysMs.RESULT_ASSEMBLY` |
| 查询接口故障 | false | 无，只能在运行时切换 | `queryOutage` |

- 启动时从配置读取默认值。开发接口在运行时修改（存在内存里的 `AtomicReference` 中）。`POST /api/dev/simulation/reset` 恢复默认值；重启后也会回到配置值。
- **快照**：受理任务时，把 `{failStage, delaysMs}` 序列化成 JSON 存进 `generation_task.sim_plan`；执行时只读这份快照。之后再改配置，不会影响已经受理的任务。
- `queryOutage` 不进快照，因为它影响的是查询接口。开启后 `GET /api/tasks` 和 `GET /api/tasks/{id}` 返回 503，后台执行照常进行。
- 开发接口只在 `DEV_API_ENABLED=true` 时注册（`@ConditionalOnProperty`），否则返回 404。调用不需要登录；README 里注明生产环境必须关闭。

## 7. 身份与会话

- 涉及两张表：`app_user`、`user_session`。
- 登录或注册成功后：
  - 生成 32 字节的随机令牌（base64url 编码），写入 Cookie `XY_SESSION`。
  - 数据库只存 `SHA-256(token)` 的十六进制。
  - 有效期由 `SESSION_TTL_HOURS` 决定，默认 168 小时。
- Cookie 属性：`HttpOnly; SameSite=Lax; Path=/; Max-Age=有效期秒数`。`Secure` 由 `SESSION_COOKIE_SECURE` 控制，本地 http 下为 false。
- `AuthInterceptor`：读取 Cookie，查找未过期的会话，把 `CurrentUser(id, username, displayName)` 放进请求属性。控制器通过 `@LoginUser CurrentUser user` 参数拿到当前用户。
- 认证通过的响应都加 `X-User-Id` 头，前端用它防止跨标签页切换用户时数据错位。
- 不需要登录的路径：`/api/auth/login`、`/api/auth/register`、`/api/auth/logout`、`/api/categories`、`/api/templates/**`、`/api/dev/**`、`/demo/**`、`/actuator/health`、`/error`。
- 密码用 `spring-security-crypto` 的 `BCryptPasswordEncoder`。只引入这个模块，不引入 Spring Security 的过滤器链。
- CSRF：依靠同源、SameSite=Lax，以及写接口只接受 JSON 或 multipart。README 里作为已知限制说明。

## 8. 配置项

后端的 `application.yml` 用 `${环境变量:默认值}` 占位。变量名必须和下表一致，因为 Compose 和 README 都依赖这些名字。默认值面向本地开发。

| 环境变量 | 默认值 | Compose 中的值 | 说明 |
|---|---|---|---|
| `DB_HOST` | localhost | mysql | |
| `DB_PORT` | 3307 | 3306 | |
| `DB_NAME` | material_studio | 同左 | |
| `DB_USER` | studio | 同左 | |
| `DB_PASSWORD` | studio_pass | 同左 | 示例值，不是真实凭据 |
| `STORAGE_ROOT` | ./data | /data | 素材、中间产物、结果的根目录 |
| `TASK_WORKERS` | 2 | 2 | worker 线程数，设成 1 可以演示排队 |
| `SIM_FAIL_STAGE` | NONE | NONE | 取值：NONE / MATERIAL_CHECK / GENERATING / RESULT_ASSEMBLY |
| `SIM_DELAY_MATERIAL_CHECK_MS` | 1500 | 1500 | |
| `SIM_DELAY_GENERATING_MS` | 4000 | 4000 | |
| `SIM_DELAY_RESULT_ASSEMBLY_MS` | 1500 | 1500 | |
| `DEV_API_ENABLED` | false（local profile 下为 true） | true | 开发接口开关 |
| `SESSION_TTL_HOURS` | 168 | 168 | |
| `SESSION_COOKIE_SECURE` | false | false | 生产环境用 https 时设为 true |
| `MATERIAL_MIN_DIMENSION` | 64 | 64 | 素材检查要求的最小边长 |

数据源等关键配置：

```yaml
spring:
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3307}/${DB_NAME:material_studio}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true
    username: ${DB_USER:studio}
    password: ${DB_PASSWORD:studio_pass}
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 11MB
server:
  shutdown: graceful
  tomcat:
    max-swallow-size: 20MB   # 超过上限时仍能读完请求体并返回 JSON 413
mybatis:
  mapper-locations: classpath:mapper/*.xml
  configuration:
    map-underscore-to-camel-case: true
```

前端只有一个配置项 `BACKEND_INTERNAL_URL`：默认 `http://localhost:8080`，Compose 构建时为 `http://backend:8080`。它在**构建时**写进 rewrites，所以 Docker 里要通过 build arg 传入。

## 9. Spring Boot 4 与依赖避坑清单（给 Codex）

1. **starter 改名了**：
   - 主依赖用 `spring-boot-starter-webmvc`（`-web` 已不推荐）、`spring-boot-starter-validation`、`spring-boot-starter-actuator`、`spring-boot-starter-flyway` 加 `org.flywaydb:flyway-mysql`。
   - 测试依赖用 `spring-boot-starter-test`、`spring-boot-starter-webmvc-test`、`spring-boot-testcontainers`、`org.testcontainers:testcontainers-mysql`、`org.testcontainers:testcontainers-junit-jupiter`。
   - 只加 `flyway-core` **不会**自动执行迁移。
2. **Jackson 3**：`JsonMapper` / `ObjectMapper` 在 `tools.jackson.databind` 包里；注解仍在 `com.fasterxml.jackson.annotation`。序列化 sim_plan 时注入 Spring 提供的 `JsonMapper`。java.time 已经内置支持，`Instant` 默认输出 ISO 字符串。
3. `@MockBean` 和 `@SpyBean` 已删除，改用 `@MockitoBean` 和 `@MockitoSpyBean`（包名 `org.springframework.test.context.bean.override.mockito`）。
4. 测试 HTTP 接口用 MockMvc（`@AutoConfigureMockMvc`），不用 TestRestTemplate。
5. 由 Boot 管理的依赖不写版本号。尤其不要给 `flyway-mysql` 写 13.x：Boot 管理的 Flyway 是 12.4，混用会出错。
6. Testcontainers：在测试类上加 `@Testcontainers(disabledWithoutDocker = true)`，用 `@Container @ServiceConnection` 启动 `mysql:8.4`。2.x 里容器类所在的包，以实际依赖为准。
7. MyBatis：
   - XML mapper 放在 `resources/mapper/` 下；mapper 接口加 `@Mapper`。
   - 实体用普通类（getter/setter），API DTO 用 record。
   - 不引入 Lombok。
8. `@TransactionalEventListener` 只有在事务里发布事件才会触发，所以提交方法必须加 `@Transactional`。
9. MySQL 8.4 默认用 caching_sha2_password，JDBC URL 要带 `allowPublicKeyRetrieval=true&useSSL=false`（§8 里已写好）。
10. **Windows 换行**：
    - `mvnw` 必须是 LF 换行，并且有可执行位（`git update-index --chmod=+x backend/mvnw`）。
    - Dockerfile 里用镜像自带的 `mvn`，不依赖 mvnw。
11. Spring Boot 默认 `java.awt.headless=true`。ImageIO 读写 JPEG/PNG 不需要字体；不要绘制文字。
12. 时间一律用 `Instant`，由注入的 `Clock` 提供，测试时可以替换。取到的时间先 `truncatedTo(ChronoUnit.MILLIS)` 再用，避免内存里的微秒值和库里的毫秒值不一致（MySQL 写入时会四舍五入）。SQL 里不要用 `NOW()`。数据库列用 `DATETIME(3)`，全链路 UTC。
13. 本地网络：拉镜像或依赖慢时，在本机配置镜像加速或代理。不要把国内镜像地址写死进 Dockerfile 或 pom。

## 10. 后端包结构

```
com.xiaoying.studio
├─ StudioApplication
├─ common/      ApiException、ErrorCode、ApiErrorResponse、GlobalExceptionHandler、ClockConfig、WebMvcConfig
├─ auth/        AuthController、AuthService、AuthInterceptor、CurrentUser、@LoginUser 及参数解析器、
│               UserMapper、SessionMapper、TokenHasher
├─ template/    TemplateController、TemplateService、TemplateMapper、实体与 DTO
├─ material/    MaterialController、MaterialService、MaterialMapper、FileStorage、ImageSniffer、实体与 DTO
├─ task/        TaskController、TaskSubmissionService、TaskQueryService、TaskMapper、TaskStepMapper、
│  │            TaskMaterialMapper、枚举、实体与 DTO
│  └─ engine/   TaskDispatcher、LocalTaskDispatcher、TaskCreatedEvent、TaskEnqueueListener、TaskRunner、
│               TaskPipeline、TaskStep、MaterialCheckStep、GenerationStep、ResultAssemblyStep、
│               StepFailedException、StepSimulator、TaskContext、TaskStateStore、MyBatisTaskStateStore、
│               TaskRecovery、TaskExecutorConfig
└─ simulation/  SimulationProperties、SimulationSettings、SimulationPlan、DevSimulationController、
                QueryOutageInterceptor
```
