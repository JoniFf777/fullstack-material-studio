# 03 接口契约

**这份文件是前后端对齐的唯一依据。**

- 后端：路径、字段名、枚举值、错误码、HTTP 状态码必须和这里一致。
- 前端：类型直接照抄 §2。
- `verify/fixtures/` 里的 JSON 是本文件的样例化版本，测试和冒烟脚本都用它来比对字段（见 06 §6）。
- 要改契约：先改这里，再同步改夹具和代码，并通知对方。

## 1. 约定

| 项 | 约定 |
|---|---|
| 前缀 | 所有业务接口都在 `/api` 下 |
| 格式 | 请求和响应都是 JSON（UTF-8）；只有上传用 `multipart/form-data` |
| 时间 | ISO-8601 UTC 字符串，以 `Z` 结尾，例如 `2026-11-10T08:30:00.123Z`。服务端精度为毫秒（与 `DATETIME(3)` 一致），毫秒为 0 时可以不输出小数部分。前端一律用 `Date.parse` 比较先后，不做字符串比较 |
| ID | 用户、素材、任务的 id 是 JSON 数字；模板 id 是字符串，例如 `travel-postcard` |
| 空值 | 字段为空时返回 `null`，不省略字段 |
| 列表 | 统一包一层：`{ "items": [...] }` |
| 认证 | 用 Cookie `XY_SESSION`（HttpOnly）。未登录或会话过期时返回 401 `UNAUTHENTICATED` |
| 用户头 | 认证通过的响应带 `X-User-Id: <当前用户 id>` |
| 错误体 | `{ "code": "...", "message": "中文说明", "fieldErrors": [] }`；只有 `VALIDATION_FAILED` 的 `fieldErrors` 非空 |
| 文案 | `message` 是给用户看的中文，前端可以直接显示 |

## 2. 类型定义

前端放在 `frontend/src/lib/api/types.ts`，后端 DTO 的 JSON 字段名和这里一致。

```ts
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type TaskStage = 'MATERIAL_CHECK' | 'GENERATING' | 'RESULT_ASSEMBLY';
export type StepStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface UserDto {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface CategoryDto {
  code: string;
  name: string;
  templateCount: number;        // 该分类下已上架的模板数，可以是 0
}

export interface TemplateSummaryDto {
  id: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  coverUrl: string;             // 例如 /demo/covers/travel-postcard.png
  requiredImageCount: number;
}

export interface TemplateDetailDto extends TemplateSummaryDto {
  description: string;
  acceptedMimeTypes: string[];  // 例如 ["image/jpeg", "image/png"]
  maxFileSizeBytes: number;
}

export interface MaterialDto {
  id: number;
  originalName: string;
  mimeType: string;             // 服务端按文件头识别出的真实类型
  sizeBytes: number;
  url: string;                  // /api/materials/{id}/content
  createdAt: string;
}

export interface TaskStepDto {
  stage: TaskStage;
  status: StepStatus;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;       // 成功时是摘要（如"已检查 2 张图片"），失败时是原因
}

export interface TaskMaterialDto {
  slotIndex: number;            // 从 0 开始，与提交时 materialIds 的顺序一致
  materialId: number;
  url: string;
}

export interface TaskDto {
  id: number;
  templateId: string;
  templateTitle: string;
  coverUrl: string;
  status: TaskStatus;
  stage: TaskStage | null;      // 语义见下表
  failedStage: TaskStage | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultUrl: string | null;     // 只有 SUCCEEDED 时有值：/api/tasks/{id}/result
  materials: TaskMaterialDto[];
  steps: TaskStepDto[];         // 按执行顺序，只包含已经开始的步骤
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface SimulationSettingsDto {
  failStage: TaskStage | 'NONE';
  delaysMs: Record<TaskStage, number>;
  queryOutage: boolean;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors: { field: string; message: string }[];
}
```

`TaskDto` 各字段在不同状态下的取值：

| status | stage | failedStage | errorCode / errorMessage | resultUrl | steps 示例 |
|---|---|---|---|---|---|
| PENDING | null | null | null | null | `[]` |
| PROCESSING | 正在执行的阶段 | null | null | null | `[素材检查 成功, 模拟生成 运行中]` |
| SUCCEEDED | RESULT_ASSEMBLY | null | null | `/api/tasks/{id}/result` | 三条都成功 |
| FAILED | 失败时所处的阶段 | 与 stage 相同 | 有值 | null | `[素材检查 成功, 模拟生成 失败]` |

如果任务在进入任何阶段之前就失败（极少见，例如刚抢占到任务就遇到重启），FAILED 时 stage 和 failedStage 都是 null。

## 3. 接口一览

| # | 方法 | 路径 | 需要登录 | 说明 |
|---|---|---|---|---|
| 1 | POST | /api/auth/register | 否 | 注册并登录 |
| 2 | POST | /api/auth/login | 否 | 登录 |
| 3 | POST | /api/auth/logout | 否 | 退出（幂等） |
| 4 | GET | /api/auth/me | 是 | 当前用户 |
| 5 | GET | /api/categories | 否 | 分类列表 |
| 6 | GET | /api/templates | 否 | 模板列表，可按分类筛选 |
| 7 | GET | /api/templates/{id} | 否 | 模板详情 |
| 8 | POST | /api/materials | 是 | 上传素材 |
| 9 | GET | /api/materials/{id}/content | 是 | 素材图片 |
| 10 | POST | /api/tasks | 是 | 提交制作任务 |
| 11 | GET | /api/tasks | 是 | 我的任务列表 |
| 12 | GET | /api/tasks/{id} | 是 | 任务详情 |
| 13 | GET | /api/tasks/{id}/result | 是 | 结果图片 |
| 14 | GET | /api/dev/simulation | 否\* | 查看模拟配置 |
| 15 | PATCH | /api/dev/simulation | 否\* | 修改模拟配置 |
| 16 | POST | /api/dev/simulation/reset | 否\* | 恢复默认配置 |
| 17 | GET | /actuator/health | 否 | 健康检查 |
| 18 | GET | /demo/covers/{file} | 否 | 模板封面（静态文件） |

\* 只有 `DEV_API_ENABLED=true` 时存在，否则返回 404。

## 4. 接口详情

### 4.1 账号

**1. 注册** `POST /api/auth/register`

```json
{ "username": "bob_01", "password": "secret123", "displayName": "Bob" }
```

- 校验规则：
  - username 匹配 `^[A-Za-z0-9_]{3,20}$`
  - password 长度 6–64
  - displayName 可省略，默认等于 username；最长 20
- 201：`{ "user": UserDto }`，并 `Set-Cookie: XY_SESSION=...`
- 错误：400 `VALIDATION_FAILED`；409 `USERNAME_TAKEN`

**2. 登录** `POST /api/auth/login`

```json
{ "username": "demo", "password": "demo123" }
```

- 200：`{ "user": UserDto }`，并设置 Cookie
- 错误：400 `VALIDATION_FAILED`；401 `INVALID_CREDENTIALS`（不区分"用户不存在"和"密码错误"）

**3. 退出** `POST /api/auth/logout`

- 返回 204。有会话就删除，没有也返回 204。响应会清除 Cookie（`Max-Age=0`）。

**4. 当前用户** `GET /api/auth/me`

- 200：`{ "user": UserDto }`
- 错误：401 `UNAUTHENTICATED`

### 4.2 模板

**5. 分类** `GET /api/categories`

- 200：`{ "items": CategoryDto[] }`，按 sort_order 排序，包括 templateCount 为 0 的分类。
- "全部"由前端自己加，不在返回结果里。

**6. 模板列表** `GET /api/templates?category={code}`

- 不带 category 时返回全部已上架模板；带上时只返回该分类的模板。
- 排序：先按分类的 sort_order，再按模板的 sort_order。
- 未知分类返回 200 和空列表。
- 200：`{ "items": TemplateSummaryDto[] }`

**7. 模板详情** `GET /api/templates/{id}`

- 200：`TemplateDetailDto`
- 错误：404 `TEMPLATE_NOT_FOUND`（模板不存在或已下线）

### 4.3 素材

**8. 上传** `POST /api/materials`（multipart）

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | 图片文件 |
| `templateId` | 否 | 传了就按该模板的类型和大小限制校验 |

- 校验顺序：
  1. 文件非空
  2. 不超过全局上限 10MB
  3. 按文件头识别真实类型：只认 JPEG、PNG，不看扩展名，也不看客户端声明的类型
  4. 类型在模板允许范围内
  5. 不超过模板的大小上限
- 201：`MaterialDto`
- 错误：
  - 400 `FILE_EMPTY`
  - 400 `FILE_TYPE_NOT_ALLOWED`
  - 400 `FILE_TOO_LARGE`（超过模板限制）
  - 413 `FILE_TOO_LARGE`（超过全局上限）
  - 404 `TEMPLATE_NOT_FOUND`
  - 401

**9. 素材内容** `GET /api/materials/{id}/content`

- 200：图片字节。`Content-Type` 为记录的 MIME；`Cache-Control: private, max-age=86400`
- 错误：404 `MATERIAL_NOT_FOUND`（素材不存在或不属于当前用户）

### 4.4 任务

**10. 提交** `POST /api/tasks`

```json
{ "templateId": "travel-postcard", "materialIds": [11, 12] }
```

- 可选请求头 `Idempotency-Key`（不超过 64 个字符）：
  - 前端每产生一次"新的提交意图"就生成一个 UUID，网络重试时复用同一个。
  - 同一用户用同一个 key 再次提交时，不建新任务，直接返回已有的任务：同样是 202 和 `Location` 头，响应体是这条任务的当前快照（状态可能已经推进）。
  - 两个请求并发撞上唯一键时，捕获冲突，返回已有的那条。
  - key 按用户区分：不同用户用相同的 key 互不影响。
- 校验顺序：
  1. 字段格式
  2. 模板存在且已上架
  3. 数量等于 requiredImageCount
  4. 素材没有重复
  5. 每个素材都属于当前用户
  6. 素材类型被模板接受
  7. 素材大小不超过模板上限
- 202：`TaskDto`，即受理时的快照。通常是 PENDING；如果 worker 已经抢到任务，也可能是 PROCESSING。响应头带 `Location: /api/tasks/{id}`。
- 错误：
  - 400 `VALIDATION_FAILED`
  - 404 `TEMPLATE_NOT_FOUND`
  - 400 `MATERIAL_COUNT_MISMATCH`
  - 400 `DUPLICATE_MATERIAL`
  - 400 `MATERIAL_NOT_FOUND`
  - 400 `MATERIAL_TYPE_NOT_ACCEPTED`
  - 400 `MATERIAL_TOO_LARGE`
  - 401

**11. 任务列表** `GET /api/tasks?templateId={id}&limit={n}`

- 只返回当前用户的任务，新的在前（按 id 倒序）。
- `templateId` 可选；`limit` 默认 50，最大 100。
- 200：`{ "items": TaskDto[] }`
- 错误：503 `SERVICE_UNAVAILABLE`（只在开发开关 queryOutage 打开时出现）

**12. 任务详情** `GET /api/tasks/{id}`

- 200：`TaskDto`
- 错误：404 `TASK_NOT_FOUND`（任务不存在或不属于当前用户）；503 情况同上

**13. 结果图片** `GET /api/tasks/{id}/result`

- 200：`image/jpeg`，`Cache-Control: private, max-age=86400`
- 错误：404 `TASK_RESULT_NOT_FOUND`（任务没有成功，或不属于当前用户）
- 不受 queryOutage 影响

### 4.5 开发接口（`DEV_API_ENABLED=true` 时存在）

**14.** `GET /api/dev/simulation`：返回 200 和 `SimulationSettingsDto`。

**15.** `PATCH /api/dev/simulation`：字段都可选，只修改传入的部分。

```json
{ "failStage": "GENERATING", "delaysMs": { "GENERATING": 10000 }, "queryOutage": false }
```

- 校验：delaysMs 每一项在 0–60000 之间；failStage 只能是 NONE 或三个阶段之一。
- 200：修改后的完整 `SimulationSettingsDto`
- 错误：400 `VALIDATION_FAILED`

**16.** `POST /api/dev/simulation/reset`：配置恢复成配置文件里的默认值，返回 200 和恢复后的完整 `SimulationSettingsDto`。

### 4.6 其他

- `GET /actuator/health` 返回 `{"status":"UP"}`，供 Compose 做健康检查。
- `GET /demo/covers/{file}` 是 Spring 的静态资源（`classpath:/static/demo/covers/`），公开访问。

## 5. 错误码

### 5.1 接口错误（响应体里的 code）

| code | HTTP | 场景 | 前端怎么处理 |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | 字段格式不对，附带 fieldErrors | 显示在对应输入框下方 |
| `UNAUTHENTICATED` | 401 | 未登录或会话过期 | 清空缓存，跳转登录页 |
| `INVALID_CREDENTIALS` | 401 | 用户名或密码错误 | 在登录表单里显示 |
| `USERNAME_TAKEN` | 409 | 用户名已被注册 | 在注册表单里显示 |
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在或已下线 | 详情页显示"模板不存在或已下线" |
| `FILE_EMPTY` | 400 | 上传了空文件 | 在上传位显示 message |
| `FILE_TYPE_NOT_ALLOWED` | 400 | 文件头不是 JPEG/PNG，或类型不在模板允许范围内 | 同上 |
| `FILE_TOO_LARGE` | 400 / 413 | 超过模板限制（400），或超过全局 10MB（413） | 同上 |
| `MATERIAL_NOT_FOUND` | 400 / 404 | 提交时素材不存在或不属于自己（400）；取素材内容时（404） | 提示重新上传 |
| `MATERIAL_COUNT_MISMATCH` | 400 | 数量与模板要求不符 | 显示在按钮下方 |
| `DUPLICATE_MATERIAL` | 400 | 同一素材在一次提交里重复出现 | 同上 |
| `MATERIAL_TYPE_NOT_ACCEPTED` | 400 | 类型不被该模板接受 | 同上 |
| `MATERIAL_TOO_LARGE` | 400 | 超过该模板的大小限制 | 同上 |
| `TASK_NOT_FOUND` | 404 | 任务不存在或不属于自己 | 卡片显示"任务不存在" |
| `TASK_RESULT_NOT_FOUND` | 404 | 结果不存在 | 图片位置显示占位图 |
| `SERVICE_UNAVAILABLE` | 503 | 开发开关模拟的查询故障 | 按"查询异常"处理，**不是任务失败** |
| `INTERNAL_ERROR` | 500 | 未预期的错误 | 显示通用提示 |

网络错误、超时和其他 5xx，前端统一当作"请求异常"，提示"网络或服务暂时不可用，请稍后重试"。

### 5.2 任务失败码（TaskDto.errorCode）

| errorCode | 阶段 | errorMessage 示例 |
|---|---|---|
| `SIMULATED_FAILURE` | 任一 | 素材检查失败：模拟注入的故障<br>模拟生成失败：生成服务返回错误（模拟注入）<br>结果整理失败：结果文件写入失败（模拟注入） |
| `MATERIAL_FILE_MISSING` | 素材检查 | 第 2 张图片的文件已丢失，请重新上传 |
| `MATERIAL_CORRUPTED` | 素材检查 | 第 1 张图片无法解析，可能已损坏 |
| `MATERIAL_RESOLUTION_TOO_LOW` | 素材检查 | 第 1 张图片分辨率过低（32×32），至少需要 64×64 |
| `GENERATION_FAILED` | 模拟生成 | 生成中间图失败 |
| `RESULT_WRITE_FAILED` | 结果整理 | 结果文件写入失败 |
| `INTERRUPTED` | 当时所处的阶段 | 服务重启，任务执行被中断，请重新提交 |
| `INTERNAL_ERROR` | 当时所处的阶段 | 系统内部错误，请稍后重试 |

## 6. 中文显示名（前后端统一）

| 值 | 中文 |
|---|---|
| PENDING | 等待处理 |
| PROCESSING | 处理中 |
| SUCCEEDED | 已完成 |
| FAILED | 失败 |
| MATERIAL_CHECK | 素材检查 |
| GENERATING | 模拟生成 |
| RESULT_ASSEMBLY | 结果整理 |

## 7. curl 速查（README 可直接复用）

Windows PowerShell 里请用 `curl.exe`（`curl` 在那里是 Invoke-WebRequest 的别名）。

```bash
# 登录并保存 Cookie
curl -s -c cj.txt -H 'Content-Type: application/json' -d '{"username":"demo","password":"demo123"}' localhost:8080/api/auth/login
# 上传
curl -s -b cj.txt -F file=@samples/photo-1.jpg -F templateId=travel-postcard localhost:8080/api/materials
# 提交
curl -s -b cj.txt -H 'Content-Type: application/json' -d '{"templateId":"travel-postcard","materialIds":[1,2]}' localhost:8080/api/tasks
# 查询
curl -s -b cj.txt localhost:8080/api/tasks/1
# 模拟控制：指定失败阶段 / 调整耗时 / 查询故障 / 恢复默认
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"failStage":"GENERATING"}' localhost:8080/api/dev/simulation
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"delaysMs":{"GENERATING":10000}}' localhost:8080/api/dev/simulation
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"queryOutage":true}' localhost:8080/api/dev/simulation
curl -s -X POST localhost:8080/api/dev/simulation/reset
```
