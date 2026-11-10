# 后端实现记录

## 实现决定

- 使用 Spring Initializr 生成 Java 21 / Spring Boot 4.1.2 Maven 骨架，MyBatis starter 固定 4.1.0，其余由 Boot 管理。
- Surefire 同时执行 `*Test`、`*Tests` 和 `*IT`，确保 `mvn test` 覆盖集成测试；Docker 不可用时 Testcontainers 自动跳过。
- 未定义的静态资源返回 404，采用已有的 `TASK_NOT_FOUND` 错误码和“资源不存在”提示，不新增契约错误码。
- PATH 中 Java 为 17，构建使用 `JAVA_HOME` 中 JDK 21。
- Testcontainers 使用单个套件级 MySQL：`stop()` 不随测试类执行，JVM 退出钩子调用实际关闭，避免 Spring 缓存上下文连接到已停止的容器。本机 Ryuk 镜像下载无进展，测试命令临时设 `TESTCONTAINERS_RYUK_DISABLED=true`；仓库不包含该环境设置，CI 默认使用 Ryuk。
- 注册时省略或填写纯空白显示名，均使用用户名作为显示名；登录不限制用户名字符种类，只检查非空及最大长度。未过期会话读取不续期，退出删除当前令牌。
- 原始文件名只保留末段并限制为 255 字符；磁盘文件名由 UUID 和识别出的 MIME 决定。上传事务回滚时清理已写入文件。文件头检查不解码，解码和尺寸检查留给后台阶段。

## 阶段验收

- B0：`mvn test` 3 项全部通过，包含真实 Docker/MySQL 的 `HealthIT`；local profile 的 `/actuator/health` 实测为 `{"status":"UP"}`。Wrapper 下载慢，按约定使用本机 Maven 3.9.9，未修改仓库镜像配置。
- B1：`mvn test` 4 项全部通过；local Flyway V1/V2 迁移成功，SQL 实测 5 分类 / 9 模板 / 2 用户；`smoke --self-check` 40 项全过、无提示。样例大图 1,794,725 字节，小图分别 35,298 / 28,549 字节。
- B2：`mvn test` 6 项全过；local profile `smoke --only templates` 9 项全过，包含详情字段集合、分类计数和静态封面。
- B3：`mvn test` 10 项全过，包含会话过期、令牌只存哈希、退出撤销和种子密码；local `smoke --only auth` 10 项全过。
- B4：`mvn test` 15 项全过，包含原子文件写入、路径穿越拒绝、文件头识别、全局 413、模板限制和用户隔离；local `smoke --only upload` 13 项全过。

## 问题记录

- B0：健康响应出现额外 `groups`，不符合 03 契约。先新增 `HealthIT.healthHasExactlyTheContractFields`，在真实 MySQL 上确认失败（Unexpected: groups），再关闭默认探针组。保留数据库健康检查。
