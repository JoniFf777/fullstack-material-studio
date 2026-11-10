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

## 阶段验收

- B0：`mvn test` 3 项全部通过，包含真实 Docker/MySQL 的 `HealthIT`；local profile 的 `/actuator/health` 实测为 `{"status":"UP"}`。Wrapper 下载慢，按约定使用本机 Maven 3.9.9，未修改仓库镜像配置。
- B1：`mvn test` 4 项全部通过；local Flyway V1/V2 迁移成功，SQL 实测 5 分类 / 9 模板 / 2 用户；`smoke --self-check` 40 项全过、无提示。样例大图 1,794,725 字节，小图分别 35,298 / 28,549 字节。
- B2：`mvn test` 6 项全过；local profile `smoke --only templates` 9 项全过，包含详情字段集合、分类计数和静态封面。
- B3：`mvn test` 10 项全过，包含会话过期、令牌只存哈希、退出撤销和种子密码；local `smoke --only auth` 10 项全过。
- B4：`mvn test` 15 项全过，包含原子文件写入、路径穿越拒绝、文件头识别、全局 413、模板限制和用户隔离；local `smoke --only upload` 13 项全过。
- B5：先写 `TaskPipelineTest` / `TaskStateGuardIT` 并运行确认编译失败（缺少尚未实现的引擎），再实现；最终 `mvn test` 47 项全过、0 跳过，所有指定测试类均执行。local 全量 `smoke http://localhost:8080` 69 项全过，16.3 秒；包括真实分辨率失败、快照、查询故障、用户隔离和幂等。

## 问题记录

- B0：健康响应出现额外 `groups`，不符合 03 契约。先新增 `HealthIT.healthHasExactlyTheContractFields`，在真实 MySQL 上确认失败（Unexpected: groups），再关闭默认探针组。保留数据库健康检查。
- B5：加入日志 MDC 配置时误写了重复的 `spring` YAML 键，应用集成测试复现 `found duplicate key spring`。合并为单个配置段后，全量测试和 local 冒烟通过；未改契约。
