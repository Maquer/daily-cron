# daily-cron

Cloudflare Worker：每 30 分钟 Bark push 一次，唤醒 iOS → Minis → countdown-scheduler

## 架构

```
Cloudflare Cron (每30分钟)
  → Bark push (TASK:daily-cron)
    → iOS Bark 通知 (带链接)
      → 用户点击 → Minis 终端
        → countdown-scheduler check --catchup
```

## 功能

- 定时触发 Bark push
- 通知标题：TASK:daily-cron
- 通知内容：定时唤醒 · 跑 countdown-scheduler check --catchup
- 点击通知打开：minis://open_terminal

## 部署

### 前置

- 已安装 Node.js 18+
- 已有 Cloudflare 账号，已开通 Workers 和 KV
- 已在 Bark app 里获取 key（https://bark.duti.app）

### 1. 创建 KV Namespace

在 Cloudflare Dashboard → Workers & Pages → Storage → KV → Create Namespace

命名：`TASKS`

记下创建后显示的 **Namespace ID**（一串 UUID），下一步要填到 `wrangler.jsonc`。

### 2. 填入 KV Namespace ID

打开仓库根目录的 `wrangler.jsonc`，把 `kv_namespaces[0].id` 替换成上一步的 Namespace ID：

```jsonc
"kv_namespaces": [
  { "binding": "TASKS", "id": "实际-Namespace-ID" }
]
```

### 3. 设置 Bark Secret

```bash
npx wrangler secret put BARK_KEY
# 提示输入时粘贴你的 Bark key
```

### 4. 部署 Worker

```bash
npx wrangler deploy
```

Wrangler 会自动部署 Worker、注册 Cron Trigger、绑定 KV Namespace——**不用再手动去 Dashboard 配置**。

首次部署需要 `wrangler login` 登录 Cloudflare（浏览器授权），之后即可。

### 5. 配置任务

在 KV 中写入 `tasks` 键（可通过 Dashboard 或 API）：

```json
[
  {
    "tag": "TASK:daily-cron",
    "body": "定时唤醒 · 跑 countdown-scheduler check --catchup",
    "params": {
      "isArchive": 1,
      "group": "cloudflare-cron",
      "url": "minis://open_terminal"
    }
  }
]
```

### 6. 测试

访问 `https://daily-cron.lovemaquer.workers.dev/test` 手动触发一次 Bark push。

## 更新任务

更新任务不需要重新部署 Worker，只需更新 KV 中的任务配置：

```bash
# 方法1: Cloudflare Dashboard → KV → 编辑 tasks 键
# 方法2: Cloudflare API
curl -X PUT https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/kv/namespaces/{namespace_id}/values/tasks \
  -H "Authorization: Bearer {token}" \
  -d '[{"tag":"TASK:daily-cron","body":"...","params":{}}]'
```

## 本地开发

```bash
npx wrangler dev        # 本地开发服务器，触发 /test 测试 Bark push
npx wrangler deploy     # 部署到 Cloudflare
```

## Cron 频率建议

`wrangler.jsonc` 里默认 `*/30 * * * *`（每 30 分钟）。如果你唤醒的下游任务周期是 6h~168h，30 分钟触发太密——建议改成：

| 表达式 | 频率 | 用途 |
|-------|------|------|
| `*/30 * * * *` | 每 30 分钟 | 需要 30 分钟内唤醒 |
| `0 */6 * * *` | 每 6 小时 | countdown-scheduler 6h 周期任务 |
| `0 6,18 * * *` | 每天 2 次 | 早/晚各一次 |
| `0 3 * * *` | 每天 1 次 | 凌晨 3 点（UTC，北京时间 11 点） |

改完重新 `npx wrangler deploy` 生效。


## 更新任务

更新任务不需要重新部署 Worker，只需更新 KV 中的任务配置：

```bash
# 方法1：Cloudflare Dashboard → KV → 编辑 tasks 键
# 方法2：Cloudflare API
curl -X PUT https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/kv/namespaces/{namespace_id}/values/tasks \
  -H "Authorization: Bearer {token}" \
  -d '[{"tag":"TASK:daily-cron","body":"...","params":{}}]'
```

## 本地开发

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录
wrangler login

# 部署
wrangler deploy
```