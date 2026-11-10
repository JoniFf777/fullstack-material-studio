# 04 数据与持久化

## 1. 表一览

| 表 | 作用 |
|---|---|
| `app_user` | 用户 |
| `user_session` | 登录会话（只存令牌的哈希） |
| `template_category` | 模板分类 |
| `template` | 模板 |
| `material` | 用户上传的素材。文件存在磁盘上，表里只存元数据 |
| `generation_task` | 制作任务：状态、阶段、结果、失败原因、模拟快照 |
| `generation_task_material` | 任务用到的素材，以及它们的顺序 |
| `generation_task_step` | 每一步的执行记录（可观察的边界） |

表之间的关系：

- 一个用户有多个会话、多个素材、多个任务。
- 一个分类下有多个模板。
- 一个任务对应一个模板。
- 一个任务有多条任务素材记录和多条步骤记录。

## 2. 表结构（`V1__schema.sql`）

```sql
CREATE TABLE app_user (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  username      VARCHAR(32)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(64)  NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_session (
  token_hash CHAR(64)    NOT NULL,
  user_id    BIGINT      NOT NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_session_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE template_category (
  code       VARCHAR(32) NOT NULL,
  name       VARCHAR(32) NOT NULL,
  sort_order INT         NOT NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE template (
  id                   VARCHAR(64)  NOT NULL,
  category_code        VARCHAR(32)  NOT NULL,
  title                VARCHAR(64)  NOT NULL,
  description          VARCHAR(500) NOT NULL,
  cover_url            VARCHAR(255) NOT NULL,
  required_image_count INT          NOT NULL,
  accepted_mime_types  VARCHAR(128) NOT NULL COMMENT '逗号分隔，如 image/jpeg,image/png',
  max_file_size_bytes  BIGINT       NOT NULL,
  sort_order           INT          NOT NULL,
  enabled              TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_template_category (category_code, sort_order),
  CONSTRAINT fk_template_category FOREIGN KEY (category_code) REFERENCES template_category (code),
  CONSTRAINT ck_template_image_count CHECK (required_image_count BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE material (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  user_id       BIGINT       NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(32)  NOT NULL,
  size_bytes    BIGINT       NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  storage_key   VARCHAR(255) NOT NULL COMMENT '相对 STORAGE_ROOT 的路径',
  created_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_material_user (user_id, id),
  CONSTRAINT fk_material_user FOREIGN KEY (user_id) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE generation_task (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  user_id           BIGINT       NOT NULL,
  template_id       VARCHAR(64)  NOT NULL,
  status            VARCHAR(16)  NOT NULL COMMENT 'PENDING / PROCESSING / SUCCEEDED / FAILED',
  stage             VARCHAR(32)  NULL     COMMENT 'MATERIAL_CHECK / GENERATING / RESULT_ASSEMBLY',
  failed_stage      VARCHAR(32)  NULL,
  error_code        VARCHAR(64)  NULL,
  error_message     VARCHAR(500) NULL,
  result_key        VARCHAR(255) NULL     COMMENT '相对 STORAGE_ROOT 的结果文件路径',
  sim_plan          VARCHAR(500) NOT NULL COMMENT '受理时的模拟配置快照（JSON）',
  client_request_id VARCHAR(64)  NULL     COMMENT 'Idempotency-Key',
  created_at        DATETIME(3)  NOT NULL,
  started_at        DATETIME(3)  NULL,
  finished_at       DATETIME(3)  NULL,
  updated_at        DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_task_client_request (user_id, client_request_id),
  KEY idx_task_user (user_id, id),
  KEY idx_task_user_template (user_id, template_id, id),
  KEY idx_task_status (status, id),
  CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES app_user (id),
  CONSTRAINT fk_task_template FOREIGN KEY (template_id) REFERENCES template (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE generation_task_material (
  task_id     BIGINT NOT NULL,
  slot_index  INT    NOT NULL,
  material_id BIGINT NOT NULL,
  PRIMARY KEY (task_id, slot_index),
  CONSTRAINT fk_tm_task FOREIGN KEY (task_id) REFERENCES generation_task (id),
  CONSTRAINT fk_tm_material FOREIGN KEY (material_id) REFERENCES material (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE generation_task_step (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  task_id     BIGINT       NOT NULL,
  stage       VARCHAR(32)  NOT NULL,
  status      VARCHAR(16)  NOT NULL COMMENT 'RUNNING / SUCCEEDED / FAILED',
  started_at  DATETIME(3)  NOT NULL,
  finished_at DATETIME(3)  NULL,
  message     VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_step_task_stage (task_id, stage),
  CONSTRAINT fk_step_task FOREIGN KEY (task_id) REFERENCES generation_task (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

说明：

- `uk_task_client_request` 允许多个 NULL，不带幂等键的提交互不影响。
- 步骤记录按 `id` 排序，插入顺序就是执行顺序。

## 3. 种子数据（`V2__seed.sql`）

### 3.1 分类

| code | name | sort_order | 说明 |
|---|---|---|---|
| hot | 热门 | 1 | |
| pets | 萌宠 | 2 | |
| festival | 节日 | 3 | |
| travel | 旅行 | 4 | |
| wedding | 婚礼 | 5 | 只有一个已下线的模板，用来演示空分类 |

### 3.2 模板

封面统一是 `/demo/covers/{id}.png`。大小限制 5MB = 5242880 字节，200KB = 204800 字节。

| id | 分类 | 标题 | 图片数 | 允许类型 | 大小上限 | 排序 | 上架 | 描述 / 演示用途 |
|---|---|---|---|---|---|---|---|---|
| hot-avatar | hot | 迷你头像 | 1 | jpeg, png | 200KB | 1 | 是 | 上传 1 张清晰的照片，生成一枚头像。限制较严，用来演示大小校验 |
| hot-film | hot | 复古胶片 | 1 | jpeg | 5MB | 2 | 是 | 上传 1 张照片，模拟生成胶片风格作品。只接受 JPG，用来演示类型校验 |
| pet-sticker | pets | 萌宠贴纸 | 1 | jpeg, png | 5MB | 1 | 是 | 上传 1 张宠物照片，模拟生成一张贴纸 |
| pet-duo | pets | 双宠合影 | 2 | jpeg, png | 5MB | 2 | 是 | 上传 2 张宠物照片，拼成一张合影 |
| festival-hug | festival | 节日拥抱 | 2 | jpeg, png | 5MB | 1 | 是 | 上传 2 张照片，模拟生成节日拥抱合照 |
| festival-card | festival | 新年贺卡 | 1 | png | 5MB | 2 | 是 | 上传 1 张 PNG 图片，模拟生成新年贺卡。只接受 PNG |
| travel-postcard | travel | 旅行明信片 | 2 | jpeg, png | 5MB | 1 | 是 | 上传 2 张旅行照片，模拟生成一张明信片 |
| travel-triptych | travel | 旅途三联拼 | 3 | jpeg, png | 5MB | 2 | 是 | 上传 3 张照片，拼成三联画 |
| wedding-invite | wedding | 婚礼请柬 | 2 | jpeg, png | 5MB | 1 | **否** | 已下线，访问详情返回 404 |

结果：首页有 5 个分类、8 个上架模板；"婚礼"分类为空；图片数量覆盖 1、2、3 张。

### 3.3 演示用户

| username | 密码 | displayName |
|---|---|---|
| demo | demo123 | 演示用户 |
| alice | alice123 | Alice |

- 哈希由 Codex 用 `BCryptPasswordEncoder`（强度 10）现场计算后写进 SQL，`SeedPasswordTest` 负责校验。
- 明文只出现在 README 和登录页的提示里，属于测试凭据。

## 4. 状态机与 SQL 守卫

```
                claim                  enterStage（素材检查 → 模拟生成 → 结果整理）          succeed
  PENDING ─────────────► PROCESSING ──────────────────────────────► PROCESSING ──────────► SUCCEEDED
     │                       │
     │                       │ 步骤失败 / 未预期异常 / 重启中断
     └───────────────────────┴────────────────────────────────────────────────────────────► FAILED
```

| 从 | 到 | 触发 | WHERE 条件 |
|---|---|---|---|
| PENDING | PROCESSING | worker 抢占 | `id = ? AND status = 'PENDING'` |
| PROCESSING | PROCESSING（stage 变化） | 进入下一步 | `id = ? AND status = 'PROCESSING'` |
| PROCESSING | SUCCEEDED | 第三步完成 | `id = ? AND status = 'PROCESSING'` |
| PENDING 或 PROCESSING | FAILED | 步骤失败、异常、重启中断 | `id = ? AND status IN ('PENDING', 'PROCESSING')` |
| SUCCEEDED / FAILED | — | 没有任何转移 | 终态 |

MyBatis XML 片段：

```xml
<update id="claim">
  UPDATE generation_task
     SET status = 'PROCESSING', started_at = #{now}, updated_at = #{now}
   WHERE id = #{id} AND status = 'PENDING'
</update>

<update id="enterStage">
  UPDATE generation_task
     SET stage = #{stage}, updated_at = #{now}
   WHERE id = #{id} AND status = 'PROCESSING'
</update>

<update id="succeed">
  UPDATE generation_task
     SET status = 'SUCCEEDED', result_key = #{resultKey}, finished_at = #{now}, updated_at = #{now}
   WHERE id = #{id} AND status = 'PROCESSING'
</update>

<update id="fail">
  UPDATE generation_task
     SET status = 'FAILED', failed_stage = #{stage}, error_code = #{code}, error_message = #{message},
         finished_at = #{now}, updated_at = #{now}
   WHERE id = #{id} AND status IN ('PENDING', 'PROCESSING')
</update>

<insert id="insertRunningStep">
  INSERT INTO generation_task_step (task_id, stage, status, started_at)
  VALUES (#{taskId}, #{stage}, 'RUNNING', #{now})
</insert>

<update id="finishStep">
  UPDATE generation_task_step
     SET status = #{status}, finished_at = #{now}, message = #{message}
   WHERE task_id = #{taskId} AND stage = #{stage} AND status = 'RUNNING'
</update>
```

mapper 方法都返回 `int`（受影响的行数），由 `TaskStateStore` 判断是否为 1。

启动恢复（在同一个事务里执行；见 02 §5.6）：

```sql
UPDATE generation_task
   SET status = 'FAILED', failed_stage = stage, error_code = 'INTERRUPTED',
       error_message = '服务重启，任务执行被中断，请重新提交', finished_at = ?, updated_at = ?
 WHERE status = 'PROCESSING';

UPDATE generation_task_step
   SET status = 'FAILED', finished_at = ?, message = '服务重启，步骤被中断'
 WHERE status = 'RUNNING';
```

恢复事务提交后，执行 `SELECT id FROM generation_task WHERE status = 'PENDING' ORDER BY id`，把查到的任务逐个重新派发。

## 5. 模拟快照格式（`sim_plan`）

```json
{"failStage":"GENERATING","delaysMs":{"MATERIAL_CHECK":1500,"GENERATING":4000,"RESULT_ASSEMBLY":1500}}
```

- 没有设置失败阶段时，`failStage` 为 `"NONE"`。
- `queryOutage` 不进快照。
- 快照不通过 API 返回给普通用户。

## 6. 查询要点

- **列表**：
  1. 先查任务：`WHERE user_id = ? [AND template_id = ?] ORDER BY id DESC LIMIT ?`，JOIN template 取 title 和 cover_url。
  2. 再用 `task_id IN (...)` 一次查出这些任务的全部步骤和素材。
  3. 在 Java 里组装。这样避免 N+1 查询。
- **详情**：`WHERE id = ? AND user_id = ?`，查不到就返回 404。
- **排序**：步骤按 `id` 排序，素材按 `slot_index` 排序。
- **只读**：查询服务不调用任何写方法，查询接口所在的类里也不注入 `TaskStateStore`。

## 7. 文件存储

```
${STORAGE_ROOT}/
├─ materials/{userId}/{yyyyMM}/{uuid}.jpg|png   上传的素材
├─ work/{taskId}/generated.png                   模拟生成的中间图（结果整理后删除）
└─ results/{userId}/{taskId}.jpg                 最终结果
```

- **写文件**：先写到同目录下的 `.tmp` 文件，再 `Files.move(..., ATOMIC_MOVE)`；不支持原子移动时退回到 `REPLACE_EXISTING`。
- **表里只存相对路径**（storage_key / result_key）。读文件时，`root.resolve(key).normalize()` 必须仍在 root 之下，防止路径穿越。
- Compose 中 `/data` 挂到命名卷 `app-data`，重启容器后文件还在。

## 8. 示例图与样例文件

`scripts/GenerateDemoAssets.java` 只用 JDK（Java2D + ImageIO），在仓库根目录执行 `java scripts/GenerateDemoAssets.java`。随机种子是固定的，重复执行得到的文件相同。生成的文件提交进仓库。

**输出一：模板封面**

- 路径：`backend/src/main/resources/static/demo/covers/{templateId}.png`
- 规格：720×960，按分类配色的渐变加简单几何图形，不含文字
- 数量：9 张，包括已下线的模板

**输出二：`samples/` 下的演示文件**

| 文件 | 规格 | 用途 |
|---|---|---|
| `photo-1.jpg` | 1200×1200 JPEG，小于 200KB | 正常上传 |
| `photo-2.jpg` | 1200×900 JPEG，小于 200KB | 正常上传 |
| `photo-3.png` | 900×1200 PNG | 正常上传；"新年贺卡"只收 PNG |
| `large-photo.jpg` | 2400×1800 JPEG，带噪点，约 1–2MB | 超过"迷你头像"的 200KB 限制 |
| `tiny-32.png` | 32×32 PNG | 能上传成功，但会在素材检查阶段失败（分辨率过低） |
| `not-image.jpg` | 文本内容，扩展名是 .jpg | 前端放行，服务端按文件头拒绝 |

同时写一份 `samples/README.md`，说明每个文件的用途。
