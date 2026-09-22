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

### 1. 创建 KV Namespace

在 Cloudflare Dashboard → Workers & Pages → Storage → KV → Create Namespace

命名：`TASKS`

### 2. 配置任务

在 KV 中写入任务配置：

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

### 3. 部署 Worker

1. Cloudflare Dashboard → Workers & Pages → daily-cron → Edit
2. 粘贴 `daily-cron.js` 代码
3. 在 Settings → Variables and Secrets 中添加 Secret：
   - Name: `BARK_KEY`
   - Value: 你的 Bark key
4. 在 Settings → Triggers 中添加 Cron Trigger：
   - Cron 表达式：`*/30 * * * *`
5. 点击 Deploy

### 4. 测试

访问 `https://daily-cron.lovemaquer.workers.dev/test` 手动触发一次 Bark push。

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