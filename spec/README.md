# 全栈笔试实现规格：素材制作网站（Material Studio）

本目录是**实现前的规格**，前后端两个实现者共用同一份：

- **后端** `backend/`：Codex 实现
- **前端** `frontend/`：Claude 实现。等你确认规格、并且验证资产就位之后才开始
- **验证资产、联调、Compose、CI、README 初稿**：Claude
- **人工验收、README 个人部分、交付**：你

`fullstack-material-studio/` 将来就是提交的仓库根目录。

> **保密提醒**：题面写明不得复制、传播。spec/ 是对题目的转述和分析。仓库如果公开，提交前删掉 spec/；更稳妥的做法是用私有仓库或压缩包交付。README 里不要贴题面原文。

## 阅读顺序

| 文件 | 内容 | 谁读 |
|---|---|---|
| [01-problem-analysis.md](01-problem-analysis.md) | 需求拆解（R-01~R-14 → 验收点）、红线、范围、为什么不加 RocketMQ / Redis | 全部 |
| [02-architecture.md](02-architecture.md) | 选型与版本、仓库结构、运行拓扑、后端异步执行模型、配置项、Spring Boot 4 避坑 | 后端必读 |
| [03-api.md](03-api.md) | **前后端契约**：接口、字段、枚举、错误码。冲突时以它为准 | 全部 |
| [04-data-and-persistence.md](04-data-and-persistence.md) | 表结构、种子数据、状态守卫 SQL、文件存储、示例图 | 后端 |
| [05-frontend.md](05-frontend.md) | 页面、组件、异步状态管理、上传位状态机、轮询生命周期、无障碍 | 前端 |
| [06-verification-and-tests.md](06-verification-and-tests.md) | **验证与测试方案**：需求追踪矩阵、阶段门槛、后端和前端的测试设计、契约夹具、API 冒烟、人工清单、CI | 全部 |
| [07-tasks.md](07-tasks.md) | 分工、执行顺序、阶段任务清单、README 清单、提交前检查 | 全部 |

## 已定的关键决策

1. **选型**（2026-11-10 核实）：Next.js 16.4、React 19、TypeScript 5.9；Java 21、Spring Boot 4.1.x、mybatis-spring-boot-starter 4.1.0、Flyway、MySQL 8.4 LTS；Node 24；Docker Compose；GitHub Actions。
2. **不引入 RocketMQ / Redis**（理由见 01 §5）。异步执行用数据库任务表（唯一事实来源）加进程内线程池。派发抽象成 `TaskDispatcher` 接口，给以后换 MQ 留口子。
3. **提交**：先同步校验，再在事务里建任务（PENDING），**事务提交之后**才投递给线程池，然后返回 202 和任务 ID。
4. **三步流水线**：素材检查 → 模拟生成 → 结果整理。
   - 每一步都写一条 `generation_task_step` 记录。
   - 每次状态变更都是一个独立的短事务。
   - 所有状态更新都带 SQL 守卫，任务结束后不可能回到处理中。
5. **模拟控制**：配置文件给默认值，开发接口可以随时修改失败阶段、各步耗时，以及让查询接口故障。**受理任务时把当时的模拟配置快照进任务**，所以同时演示"A 失败、B 成功"不需要卡时机。
6. **身份**：用户名 + 密码（BCrypt），会话放在 HttpOnly Cookie 里，数据库只存令牌的哈希。预置演示账号，也可以注册。任务、素材、结果都按 user_id 隔离，越权一律返回 404。
7. **连接方式**：浏览器只访问 Next（:3000），Next 用 rewrites 把 `/api/*`、`/demo/*` 转给 Java（:8080）。因为同源，不需要 CORS，`<img>` 请求受保护的图片也会自动带上 Cookie。
8. **前端状态**：
   - 用 TanStack Query 管服务端状态。
   - 每个未完成任务单独轮询，到终态就停。
   - **查询失败只提示"状态获取失败"，绝不把任务显示成失败。**
   - 查询 key 带 userId；切换用户时取消所有请求并清空缓存。
9. **并行开发靠契约**：前后端只通过 03-api.md 对齐。契约要改，先改 03，再改代码，并通知对方。
10. **验证先行**：编码前，Claude 先写好三样验证资产：
    - 契约夹具 `verify/fixtures/`
    - API 冒烟脚本 `verify/smoke.mjs`
    - 人工验收清单 `verify/CHECKLIST.md`

    后端从 B2 起用冒烟脚本做阶段验收。核心模块（后端流水线、前端任务跟踪）先写测试，再写实现。

## 执行顺序（目标一天）

详见 [07-tasks.md §1](07-tasks.md)。

| 顺序 | 谁 | 做什么 | 约用时 |
|---|---|---|---|
| 1 | 你 | 看本页、03、06；装 JDK 21 | 20 分钟 |
| 2 | Claude | I0：初始化仓库，写好验证资产（夹具、冒烟脚本、人工清单）。**这一步不写前端** | 40 分钟 |
| 3 | 你 | 把下面的提示词贴给 Codex | 2 分钟 |
| 4 | Codex ∥ Claude | 后端 B0–B7 和前端 F0–F7 同时进行，各自按 06 §3 的门槛推进 | 3–4 小时 |
| 5 | Claude | I1–I3：补全 compose 和 CI，从零构建，跑冒烟脚本和人工清单 | 1 小时 |
| 6 | Claude → Codex | I4：审查后端，问题写成提示词交给 Codex 修 | 30 分钟 |
| 7 | 你 + Claude | I5：写 README；你亲手走查、写个人部分、选定验收 commit | 1 小时 |

## 交给 Codex 的启动提示词（后端，直接复制）

```text
你在 fullstack-material-studio/ 仓库里工作，只负责后端。前端由另一个 AI 在 frontend/ 里并行开发。

开始前：完整阅读 spec/ 下的全部文件（重点 02、03、04、06），然后按 spec/07-tasks.md 里 B0–B7 的顺序实现。

协作规则
1. 只修改 backend/、scripts/GenerateDemoAssets.java、samples/。不要改 frontend/、spec/、verify/、根目录的 docker-compose.yml、.env.example、.github/、README.md。
2. 提交时只 add 自己的路径：git add backend scripts/GenerateDemoAssets.java samples。禁止 git add -A 和 git commit -a。提交信息以阶段号开头，例如 "B5: task engine"。
3. 接口必须和 spec/03-api.md 完全一致：路径、字段名、枚举值、错误码、HTTP 状态码。verify/fixtures/ 里的 JSON 是契约样例，响应的字段集合必须和它们一致。发现契约有问题时先停下来说明，不要自己改契约。
4. 规格没覆盖的细节，选最简单的合理做法，并记到 backend/DECISIONS.md。

技术要求
5. Java 21；Spring Boot 4.1.x（Maven，带 mvnw）；mybatis-spring-boot-starter 4.1.0；MySQL 8.4；Flyway。由 Spring Boot 管理版本的依赖不要写版本号。严格遵守 spec/02-architecture.md 第 9 节的避坑清单。
6. 本地环境：JAVA_HOME 指向 JDK 21，机器上还装着 JDK 17。执行 java 命令之前先看 java -version；如果显示的不是 21，就用 JAVA_HOME 下的 java。本地数据库：在仓库根目录执行 docker compose up -d mysql（宿主机端口 3307）。本地运行：./mvnw spring-boot:run -Dspring-boot.run.profiles=local。如果 ./mvnw 下载依赖很慢，可以改用本机的 mvn（它的全局配置里有国内镜像），参数不变；不要把镜像地址写进仓库。

红线（违反即严重缺陷）
7. 提交接口只做校验和建任务，不能等待任何步骤；投递线程池必须发生在事务提交之后。
8. 查询接口只读，不能推进任务，也不能修改任何状态。
9. SUCCEEDED 和 FAILED 是终态。所有状态更新语句都要带 status 条件，终态不能被改回。
10. 不能把整条流水线包在一个事务里。每次状态变更是独立的短事务，执行中的阶段必须能被查询看到。
11. 某一步失败后，后面的步骤不能执行；必须保存失败阶段、错误码和中文原因。
12. 任务、素材、结果的所有查询都按当前用户过滤，越权一律返回 404。

验证（各阶段门槛见 spec/06 第 3 节）
13. B5 先写 TaskPipelineTest 和 TaskStateGuardIT（这时它们应该失败），再写实现，直到全部通过。
14. 每个阶段完成后运行 ./mvnw test。全部通过、并满足该阶段门槛后，才进入下一阶段。Testcontainers 用例在没有 Docker 时自动跳过；本机有 Docker 时必须通过。
15. 从 B2 起，应用以 local profile 运行时，用 node verify/smoke.mjs http://localhost:8080 --only <段名> 做阶段验收；B5 结束时不带 --only，必须全部通过。
16. 发现缺陷时，先补一个能复现它的测试，再修。问题和修法记到 backend/DECISIONS.md 的"问题记录"一节。
17. 不要提交真实密钥，示例配置只放无害的默认值。
```

## Claude 写前端时遵守同样的规则

- 只改 `frontend/`。根目录的 compose、CI、README 等到联调阶段再改。
- 只用 `git add frontend` 提交。
- 接口严格按 03-api.md。
- 规格之外的决定记到 `frontend/DECISIONS.md`。
- 任务跟踪相关的测试先写（06 §5）。

## 你自己要做的（AI 替代不了）

- 按 `verify/CHECKLIST.md` 亲手走一遍，把结果填进去。
- 记录实际投入：开始时间、结束时间，以及中间卡住的地方。
- README 的「AI 使用说明」用第一人称写，并举一个具体例子：问题怎么发现、给了 AI 什么上下文、AI 改了什么、你怎么验证。
- 能讲清楚下面这些（面试大概率会问）：
  - 为什么任务不会因为查询变回处理中（SQL 守卫，加上查询只读）
  - 为什么要等事务提交之后才投递任务
  - 前端怎么区分"查询失败"和"任务失败"
  - 切换用户时，旧请求怎么被取消，为什么不会写进新用户的数据
  - 为什么没用 RocketMQ / Redis，以后要加的话加在哪里
- 选定验收 commit，决定交付方式。
