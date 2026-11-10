# 人工验收清单

对应 spec/06 §8。默认用 Compose 启动：前端 http://localhost:3000，后端（开发接口）http://localhost:8080。

- 每一行填写结果（✓ 或 ✗）、日期和备注。
- 出现 ✗ 时，按 spec/06 §11 处理：记录复现步骤，补一个能复现的测试，再修。
- 除非场景另有说明，**每个场景开始前先 reset 模拟配置**（命令见 §0.2）。
- 样例文件在 `samples/` 下，说明见 `samples/README.md`。

## 总览

| 场景 | 需求 | 结果 | 日期 | 备注 |
|---|---|---|---|---|
| P 准备 | R-14 | | | |
| S01 浏览与筛选 | R-02、R-03 | | | |
| S02 上传交互 | R-03、R-07 | | | |
| S03 成功流程 | R-04、R-05、R-07 | | | |
| S04 指定阶段失败 | R-06 | | | |
| S05 多任务互不串扰与排队 | R-04、R-08 | | | |
| S06 调整耗时 | R-06 | | | |
| S07 关闭页面不中断 | R-04 | | | |
| S08 刷新恢复 | R-09 | | | |
| S09 查询异常不等于任务失败 | R-07 | | | |
| S10 停止轮询 | R-08 | | | |
| S11 用户隔离与切换 | R-10、R-08 | | | |
| S12 重启边界 | README 说明项 | | | |
| S13 素材检查的真实失败 | R-05 | | | |
| K 键盘走查 | R-11 | | | |
| M 小屏走查 | R-11 | | | |
| V 对照截图 | R-11 | | | |
| E 证据收集（可选） | R-13 | | | |

## 0. 准备

### 0.1 启动

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| P1 | `docker compose down -v`，再 `docker compose up --build --wait` | 三个服务都是 healthy | | | |
| P2 | `node verify/smoke.mjs` | 全部 ✓，退出码为 0 | | | |
| P3 | 浏览器打开 http://localhost:3000，用 demo / demo123 登录 | 进入首页 | | | |

### 0.2 模拟控制命令

Windows PowerShell 5.1 会吃掉传给 `curl.exe` 的 JSON 里的双引号，所以这里用 `Invoke-RestMethod`：

```powershell
$sim = 'http://localhost:8080/api/dev/simulation'
Invoke-RestMethod -Method Patch -Uri $sim -ContentType 'application/json' -Body '{"failStage":"GENERATING"}'        # 指定失败阶段
Invoke-RestMethod -Method Patch -Uri $sim -ContentType 'application/json' -Body '{"delaysMs":{"GENERATING":10000}}' # 调整耗时
Invoke-RestMethod -Method Patch -Uri $sim -ContentType 'application/json' -Body '{"queryOutage":true}'               # 打开查询故障
Invoke-RestMethod -Method Patch -Uri $sim -ContentType 'application/json' -Body '{"queryOutage":false}'              # 关闭查询故障
Invoke-RestMethod -Method Post -Uri "$sim/reset"                                                                     # 恢复默认
```

bash / zsh：

```bash
SIM=http://localhost:8080/api/dev/simulation
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"failStage":"GENERATING"}' $SIM
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"delaysMs":{"GENERATING":10000}}' $SIM
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"queryOutage":true}' $SIM
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"queryOutage":false}' $SIM
curl -s -X POST $SIM/reset
```

把后端切到 1 个 worker（S05、S12 用），以及恢复：

```powershell
$env:TASK_WORKERS = '1'; docker compose up -d --wait backend     # 切到 1 个 worker
Remove-Item Env:TASK_WORKERS; docker compose up -d --wait backend # 恢复为默认的 2 个
```

```bash
TASK_WORKERS=1 docker compose up -d --wait backend
docker compose up -d --wait backend
```

## 1. 演示场景

### S01 浏览与筛选（R-02、R-03）

前置：用 demo / demo123 登录。

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 打开首页 | "全部"加 5 个分类；共 8 张模板卡片，每张都有封面和标题 | | | |
| 2 | 点"萌宠" | 只剩 2 个模板；地址栏带上分类参数，刷新后仍停在"萌宠" | | | |
| 3 | 点"婚礼" | 显示空状态的说明，不是报错 | | | |
| 4 | 访问 `/templates/wedding-invite` | 显示"模板不存在或已下线"，有返回入口 | | | |
| 5 | 访问 `/templates/travel-postcard` | 显示封面、标题、说明，以及素材要求：2 张，JPG / PNG，单张不超过 5MB | | | |

### S02 上传交互（R-03、R-07）

前置：进入"旅行明信片"（需要 2 张图）。

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 第 1 个上传位选 `photo-1.jpg` | 出现进度和预览，随后标记为就绪 | | | |
| 2 | 把它换成 `photo-3.png` | 预览换成新图，上传位只保留新图的结果；旧图如果还在上传，请求会被取消 | | | |
| 3 | 点"移除" | 回到空的上传位 | | | |
| 4 | 选 `not-image.jpg` | 前端放行，服务端拒绝；上传位显示服务端给出的原因，可以重新选择 | | | |
| 5 | 进入"迷你头像"，选 `large-photo.jpg` | 前端直接提示超过 200KB，Network 面板里没有上传请求 | | | |
| 6 | 进入"复古胶片"，选 `photo-3.png` | 前端提示只支持 JPG，不发请求 | | | |
| 7 | 全程观察提交按钮 | 素材没齐时禁用，并写明还差几张；有图正在上传时显示"等待上传完成…" | | | |

### S03 成功流程（R-04、R-05、R-07）

前置：reset（默认三步耗时为 1.5 秒、4 秒、1.5 秒）。进入"旅行明信片"，上传 `photo-1.jpg` 和 `photo-2.jpg`。

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 点"立即制作" | 按钮短暂显示"提交中…"并禁用，随即恢复；上传位清空 | | | |
| 2 | 看右侧历史区 | 最前面出现新卡片，依次显示：等待处理 → 处理中 · 素材检查 → 处理中 · 模拟生成 → 处理中 · 结果整理 → 已完成，最后显示结果图 | | | |
| 3 | 点这张卡片 | 打开大图预览，显示三步各自的耗时；关闭后焦点回到卡片 | | | |
| 4 | PowerShell：`docker compose logs backend \| Select-String STEP_`（bash 用 `grep STEP_`） | 三步各有一条 STEP_START 和一条 STEP_END，带同一个 taskId | | | |
| 5 | 再上传两张图，快速连点两下"立即制作" | 只建了一个任务：历史区只多一张卡片 | | | |

### S04 指定阶段失败（R-06）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 设置 `{"failStage":"GENERATING"}`，提交一个任务 | 卡片停在"失败 · 模拟生成"，并显示原因 | | | |
| 2 | 看卡片上的步骤条 | 素材检查成功，模拟生成失败，结果整理是灰色（没有执行） | | | |
| 3 | 再提交一个 | 仍在模拟生成阶段失败（可以重复触发） | | | |
| 4 | 分别把 failStage 设为 `MATERIAL_CHECK`、`RESULT_ASSEMBLY`，各提交一次 | 各自停在对应的阶段 | | | |
| 5 | reset 后再提交 | 正常完成 | | | |

### S05 多任务互不串扰与排队（R-04、R-08）

前置：把后端切到 1 个 worker（§0.2），等它 healthy。

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 设置 `{"failStage":"RESULT_ASSEMBLY"}`，用 `photo-1.jpg` + `photo-2.jpg` 提交任务 A | A 开始处理 | | | |
| 2 | reset，马上提交 B（`photo-2.jpg` + `photo-3.png`）和 C（`photo-1.jpg` + `photo-3.png`） | B 或 C 有一段时间显示"等待处理"（在排队） | | | |
| 3 | 等三个任务都结束 | A 在"结果整理"阶段失败；B、C 成功。三张卡片的阶段、原因、结果图各不相同，结果图分别由各自的素材拼成 | | | |
| 4 | 把后端恢复为 2 个 worker（§0.2） | 后端重新 healthy | | | |

### S06 调整耗时（R-06）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 设置 `{"delaysMs":{"GENERATING":10000}}`，提交一个任务 | "模拟生成"阶段持续约 10 秒 | | | |
| 2 | reset 后再提交 | 恢复默认耗时 | | | |

### S07 关闭页面不中断（R-04）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 提交任务后立刻关闭标签页 | — | | | |
| 2 | 15 秒后打开 `/history` | 任务已经完成，能看到结果图 | | | |

### S08 刷新恢复（R-09）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 任务处理中时按 F5 | 列表从后端恢复；未完成的任务继续更新，直到结束 | | | |
| 2 | 打开 `/history`，切换状态筛选 | 能看到全部历史，筛选生效；点结果图能预览 | | | |

### S09 查询异常不等于任务失败（R-07）

前置：设置 `{"delaysMs":{"GENERATING":10000}}`，提交一个任务，等它进入"模拟生成"。

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 设置 `{"queryOutage":true}` | 几秒内，卡片仍显示"处理中"，并出现黄色提示"状态更新失败，任务仍在后台处理"和"重新查询"按钮；没有"失败"字样 | | | |
| 2 | 等 10 秒以上，设置 `{"queryOutage":false}`，再点"重新查询" | 卡片显示真实状态，通常已经完成 | | | |
| 3 | 换一种方式：开发者工具切到 Offline，几秒后切回 | 表现同上 | | | |
| 4 | reset | — | | | |

### S10 停止轮询（R-08）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 所有任务都结束后，观察 Network 面板 | 不再出现 `/api/tasks/{id}` 请求 | | | |
| 2 | 有任务处理中时，从详情页回到首页 | 相关的轮询请求停止 | | | |

### S11 用户隔离与切换（R-10、R-08）

前置：demo 名下已经有任务。

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 打开账号弹窗 | 显示头像（显示名首字）、显示名、用户名、用户 ID、注册时间 | | | |
| 2 | 点"切换账号"，用 alice / alice123 登录 | 看不到 demo 的任务；切换过程中没有闪现 demo 的数据 | | | |
| 3 | 以 alice 的身份，在地址栏访问 demo 某个任务的 `/api/tasks/{id}/result` | 返回 404 | | | |
| 4 | 退出登录 | 回到登录页；按浏览器的后退键也看不到之前的数据 | | | |

### S12 重启边界（README 说明项）

前置：把后端切到 1 个 worker（§0.2）。

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 设置 `{"delaysMs":{"GENERATING":60000}}`，提交任务 A | A 进入"模拟生成" | | | |
| 2 | reset，再提交任务 B | B 显示"等待处理"（在排队） | | | |
| 3 | A 还在"模拟生成"时，执行 `docker compose restart backend` | 后端重启后，A 变为"失败 · 模拟生成"，原因是"服务重启，任务执行被中断，请重新提交" | | | |
| 4 | 继续观察 | B 在重启后自动执行并完成 | | | |
| 5 | 把后端恢复为 2 个 worker（§0.2） | 后端重新 healthy | | | |

### S13 素材检查的真实失败（R-05）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 在"萌宠贴纸"上传 `tiny-32.png` | 上传成功：上传时只检查大小和文件头 | | | |
| 2 | 提交 | 卡片显示"失败 · 素材检查"，原因是"第 1 张图片分辨率过低（32×32），至少需要 64×64" | | | |

## 2. 走查

### K 键盘（R-11）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 只用 Tab / Shift+Tab 在首页和详情页移动 | 依次经过分类、模板卡片、上传位、替换和移除、提交按钮、账号按钮；全程看得见焦点框 | | | |
| 2 | 在上传位上按 Enter | 打开文件选择 | | | |
| 3 | 打开账号弹窗，连续按 Tab | 焦点一直在弹窗内 | | | |
| 4 | 按 Esc | 弹窗关闭，焦点回到账号按钮 | | | |
| 5 | 打开结果预览，再按 Esc | 预览关闭，焦点回到原来的卡片 | | | |

### M 小屏 375×812（开发者工具的设备模式）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 首页 | 模板列表 2 列，没有横向滚动 | | | |
| 2 | 详情页 | 上传区和历史区上下堆叠，所有按钮都能点到 | | | |
| 3 | 账号弹窗、结果预览 | 能完整显示，也能关闭 | | | |

### V 对照截图（UI-01 到 UI-04）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| 1 | 首页对照 UI-01 | 深色背景、顶栏、分类标签、竖版卡片，标题叠在封面上 | | | |
| 2 | 详情页对照 UI-02、UI-03 | 左边是封面和上传区，右边是历史区；提交后新卡片出现在最前面 | | | |
| 3 | 账号弹窗对照 UI-04 | 头像、名称、用户 ID 等信息的排布一致 | | | |

## 3. 证据收集（可选，README 可以引用）

| # | 操作 | 期望 | 结果 | 日期 | 备注 |
|---|---|---|---|---|---|
| E1 | 截图：S03 处理中、S04 失败、S09 查询异常提示、S10 Network 面板 | 保存到 `docs/screenshots/` | | | |
| E2 | `docker compose exec mysql mysql -ustudio -pstudio_pass material_studio -e "SELECT task_id, stage, status, started_at, finished_at, message FROM generation_task_step ORDER BY id DESC LIMIT 9"` | 每个任务的每一步各有一行，起止时间清楚 | | | |
| E3 | PowerShell：`docker compose logs backend \| Select-String STEP_`（bash 用 `grep STEP_`） | 能看到每一步的开始、结束和失败 | | | |
