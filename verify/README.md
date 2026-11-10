# verify：验证资产

这三样东西在写业务代码之前就准备好了（spec/06 §1）。

| 文件 | 内容 | 谁在用 |
|---|---|---|
| `fixtures/*.json` | 13 个接口响应样例，与 spec/03 §2 的类型一一对应 | 前端测试拿来当假响应；冒烟脚本拿来比对字段 |
| `smoke.mjs` | API 冒烟验收脚本。Node 24，不依赖第三方包 | 后端每个阶段的门槛、联调、CI 的 compose job |
| `CHECKLIST.md` | 人工验收清单：演示场景 S01–S13 和走查项 | 交付前亲手走一遍并填写结果 |

## 冒烟脚本

```bash
node verify/smoke.mjs --self-check                             # 不发请求：检查脚本自身、夹具、样例文件和封面
node verify/smoke.mjs http://localhost:8080 --only templates   # 直连后端，只跑一段
node verify/smoke.mjs                                          # 经过 Next 代理（:3000），跑全部
```

- 共五段：`templates`、`auth`、`upload`、`tasks`、`isolation`。
  - 前三段不需要开发接口。
  - `tasks` 和 `isolation` 需要开发接口（`DEV_API_ENABLED=true`）。运行期间会修改模拟配置，结束时 reset。不要在别人演示时运行。
- `upload`、`tasks`、`isolation` 用到 `samples/` 下的样例文件，这些文件由 `scripts/GenerateDemoAssets.java` 生成。
- 每个响应都和 `fixtures/` 比对（规则见 spec/06 §6.2）：
  - 字段集合必须相同。
  - 值类型必须相同，`null` 与任何类型兼容。
  - 数组只比对第一个元素。
  - 枚举值必须在规定范围内。
- 每个任务响应还会按 spec/03 §2 的状态表检查，字段之间不能互相矛盾。轮询时检查状态只前进、终态之后完全不变。
- 退出码：全部通过为 0；有任何 ✗ 为 1；参数错误为 2。

## 修改契约

1. 先改 spec/03。
2. 在同一个提交里同步修改 `fixtures/` 和 `smoke.mjs`，并确认 `--self-check` 通过。
3. 通知前后端各自修改代码。
