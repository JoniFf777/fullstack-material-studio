# 后端实现记录

## 实现决定

- 使用 Spring Initializr 生成 Java 21 / Spring Boot 4.1.2 Maven 骨架，MyBatis starter 固定 4.1.0，其余由 Boot 管理。
- Surefire 同时执行 `*Test`、`*Tests` 和 `*IT`，确保 `mvn test` 覆盖集成测试；Docker 不可用时 Testcontainers 自动跳过。
- 未定义的静态资源返回 404，采用已有的 `TASK_NOT_FOUND` 错误码和“资源不存在”提示，不新增契约错误码。
- PATH 中 Java 为 17，构建使用 `JAVA_HOME` 中 JDK 21。
- Testcontainers 使用单个套件级 MySQL：`stop()` 不随测试类执行，JVM 退出钩子调用实际关闭，避免 Spring 缓存上下文连接到已停止的容器。本机 Ryuk 镜像下载无进展，测试命令临时设 `TESTCONTAINERS_RYUK_DISABLED=true`；仓库不包含该环境设置，CI 默认使用 Ryuk。

## 阶段验收

- B0：`mvn test` 3 项全部通过，包含真实 Docker/MySQL 的 `HealthIT`；local profile 的 `/actuator/health` 实测为 `{"status":"UP"}`。Wrapper 下载慢，按约定使用本机 Maven 3.9.9，未修改仓库镜像配置。

## 问题记录

- B0：健康响应出现额外 `groups`，不符合 03 契约。先新增 `HealthIT.healthHasExactlyTheContractFields`，在真实 MySQL 上确认失败（Unexpected: groups），再关闭默认探针组。保留数据库健康检查。
