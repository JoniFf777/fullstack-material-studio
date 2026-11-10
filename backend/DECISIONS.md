# 后端实现记录

## 实现决定

- 使用 Spring Initializr 生成 Java 21 / Spring Boot 4.1.2 Maven 骨架，MyBatis starter 固定 4.1.0，其余由 Boot 管理。
- Surefire 同时执行 `*Test`、`*Tests` 和 `*IT`，确保 `mvn test` 覆盖集成测试；Docker 不可用时 Testcontainers 自动跳过。
- 未定义的静态资源返回 404，采用已有的 `TASK_NOT_FOUND` 错误码和“资源不存在”提示，不新增契约错误码。
- PATH 中 Java 为 17，构建使用 `JAVA_HOME` 中 JDK 21。
- Testcontainers 使用单个套件级 MySQL：`stop()` 不随测试类执行，JVM 退出钩子调用实际关闭，避免 Spring 缓存上下文连接到已停止的容器。本机 Ryuk 镜像下载无进展，测试命令临时设 `TESTCONTAINERS_RYUK_DISABLED=true`；仓库不包含该环境设置，CI 默认使用 Ryuk。
- 注册时省略或填写纯空白显示名，均使用用户名作为显示名；登录不限制用户名字符种类，只检查非空及最大长度。未过期会话读取不续期，退出删除当前令牌。
- 原始文件名只保留末段并限制为 255 字符；磁盘文件名由 UUID 和识别出的 MIME 决定。上传事务回滚时清理已写入文件。文件头检查不解码，解码和尺寸检查留给后台阶段。
- 提交校验位于 `TaskSubmissionService`；实际建任务由独立的 `TaskCreationTransaction` 的 `@Transactional` 方法执行，事务中发布事件，监听器严格 AFTER_COMMIT 派发。唯一键冲突在事务代理外捕获，回滚后重新读取已有任务，避免 MySQL 可重复读快照或 rollback-only 影响幂等返回。
- 状态存储每个方法均 `REQUIRES_NEW`；阶段守卫还限制合法前后顺序。完成步骤同时校验任务仍为 PROCESSING；终态不再更新步骤。列表与详情采用只读事务，三次批量 SELECT 处于同一 MySQL 快照，避免拼出状态和步骤不一致的响应。
- 线程池等待优雅停机 15 秒后显式 `shutdownNow()`，中断未结束的 worker；中断不标业务失败，交由下次启动恢复。队列中的任务仍在数据库保存 PENDING。
- `limit` 小于 1 返回字段校验错误，大于 100 按 100 截断；不额外扩展接口。结果保留原图比例，使用模板对应的背景补边，不绘制字体。
- 新注册账号的哈希格式为 `{bcrypt-sha256}` + BCrypt(SHA-256 的 64 位 ASCII 十六进制摘要)，强度 10。这样支持契约允许的 6–64 位 Unicode 密码且不会在 72 字节处截断。种子和早期账号仍识别普通 BCrypt；格式标记避免与普通 BCrypt 密码发生输入歧义。

## 阶段验收

- B0：`mvn test` 3 项全部通过，包含真实 Docker/MySQL 的 `HealthIT`；local profile 的 `/actuator/health` 实测为 `{"status":"UP"}`。Wrapper 下载慢，按约定使用本机 Maven 3.9.9，未修改仓库镜像配置。
- B1：`mvn test` 4 项全部通过；local Flyway V1/V2 迁移成功，SQL 实测 5 分类 / 9 模板 / 2 用户；`smoke --self-check` 40 项全过、无提示。样例大图 1,794,725 字节，小图分别 35,298 / 28,549 字节。
- B2：`mvn test` 6 项全过；local profile `smoke --only templates` 9 项全过，包含详情字段集合、分类计数和静态封面。
- B3：`mvn test` 10 项全过，包含会话过期、令牌只存哈希、退出撤销和种子密码；local `smoke --only auth` 10 项全过。
- B4：`mvn test` 15 项全过，包含原子文件写入、路径穿越拒绝、文件头识别、全局 413、模板限制和用户隔离；local `smoke --only upload` 13 项全过。
- B5：先写 `TaskPipelineTest` / `TaskStateGuardIT` 并运行确认编译失败（缺少尚未实现的引擎），再实现；最终 `mvn test` 47 项全过、0 跳过，所有指定测试类均执行。local 全量 `smoke http://localhost:8080` 69 项全过，16.3 秒；包括真实分辨率失败、快照、查询故障、用户隔离和幂等。
- B6（2026-11-10）：`mvn test` 55 项全过、0 跳过；包含 13 个真实响应与夹具字段集合比对、开发接口关闭、提交后才派发（独立 JDBC 连接可见已提交关联）、回滚不派发、重复投递只执行一次和文件损坏。修复密码边界后全量 local 冒烟再次 69 项全过，17.4 秒。

## curl 自测记录

2026-11-10，local profile，真实 MySQL 8.4，`curl.exe` 请求，通过 Cookie 认证。自测时临时设置 `TASK_WORKERS=1`，用较短延迟观察阶段，结束恢复默认模拟配置和 2 个 worker。

| 场景 | 实际结果 |
|---|---|
| S03 | 任务 #12，144ms 返回受理；观察到素材检查 → 模拟生成 → 结果整理 → SUCCEEDED |
| S04 | 任务 #13，GENERATING 阶段 FAILED，SIMULATED_FAILURE，只有前两条步骤 |
| S05 | A=#14 按受理快照在 RESULT_ASSEMBLY 失败；B=#15 成功；C=#16 提交后可见 PENDING，随后成功 |
| S09 | 任务 #17，查询列表和详情均 503；开关未关闭时结果图已返回 200；关闭开关后看到 SUCCEEDED |

原始日志和自测临时文件在 `backend/target/`，不提交 Cookie、数据库运行文件或构建产物。

## 问题记录

- B0：健康响应出现额外 `groups`，不符合 03 契约。先新增 `HealthIT.healthHasExactlyTheContractFields`，在真实 MySQL 上确认失败（Unexpected: groups），再关闭默认探针组。保留数据库健康检查。
- B5：加入日志 MDC 配置时误写了重复的 `spring` YAML 键，应用集成测试复现 `found duplicate key spring`。合并为单个配置段后，全量测试和 local 冒烟通过；未改契约。
- B6：64 位中文密码符合契约字符长度，但 UTF-8 编码为 192 字节，直接 BCrypt 抛出 `password cannot be more than 72 bytes`，注册返回 500。先新增 `AuthIT.unicodePasswordAtContractMaximumCanRegisterAndLoginWithoutTruncation` 确认 201/500 差异，再加入带标记的 SHA-256 → BCrypt 格式和普通 BCrypt 兼容分支。测试同时检查正确密码登录成功、仅末字不同被拒绝、演示账号用超长错误密码也返回 401；全量测试和冒烟均通过。

## 运行边界

- 面向单实例；任务队列不保证多实例恢复语义。PROCESSING 启动时失败，PENDING 重派发，没有自动重试或断点续跑。
- 会话数据库存哈希，HttpOnly/SameSite=Lax Cookie；没有额外 CSRF 令牌。生产环境应设置 `DEV_API_ENABLED=false`，HTTPS 时设置 `SESSION_COOKIE_SECURE=true`。
- 中间文件或历史素材没有自动清理策略。生成过程为确定的本地图形拼接；不调用真实 AI。
