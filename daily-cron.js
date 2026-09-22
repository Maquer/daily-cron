// Cloudflare Worker: daily-cron
// 从 KV 读取任务配置，更新任务只需更新 KV，无需重新部署代码
//
// 部署方式：Cloudflare Dashboard → Workers & Pages → Create Worker
// KV Namespace: TASKS（需要在 Cloudflare Dashboard 创建）
// Secrets: BARK_KEY
// Trigger: Cron */30 * * * * (UTC 每 30 分钟)

// 默认任务列表（KV 为空时使用）
const DEFAULT_TASKS = [
  {
    tag: 'TASK:daily-cron',
    body: '定时唤醒 · 跑 countdown-scheduler check --catchup',
    params: {
      isArchive: 1,
      group: 'cloudflare-cron',
      url: 'minis://open_terminal'
    }
  }
];

export default {
  // 定时触发（Cloudflare Cron Trigger）
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAllTasks(env));
  },

  // HTTP 触发
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // /test - 手动触发所有任务
    if (url.pathname === '/test') {
      const result = await runAllTasks(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // /tasks - 查看当前任务列表
    if (url.pathname === '/tasks') {
      const tasks = await getTasks(env);
      return new Response(JSON.stringify(tasks, null, 2), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // /set - 更新任务列表（需要 token 保护，这里简化处理）
    if (url.pathname === '/set' && request.method === 'POST') {
      const body = await request.json();
      const tasks = body.tasks || [];
      
      // 验证任务格式
      for (const task of tasks) {
        if (!task.tag || !task.body) {
          return new Response(
            JSON.stringify({ error: 'Each task must have tag and body' }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      }
      
      // 保存到 KV
      await env.TASKS.put('tasks', JSON.stringify(tasks));
      
      return new Response(
        JSON.stringify({ ok: true, count: tasks.length }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    
    // /delete - 删除任务配置（使用默认任务）
    if (url.pathname === '/delete' && request.method === 'POST') {
      await env.TASKS.delete('tasks');
      return new Response(
        JSON.stringify({ ok: true, message: 'Tasks deleted, using default' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    
    // 默认响应
    return new Response(
      'daily-cron worker running. Endpoints: /test, /tasks, /set (POST), /delete (POST)',
      { status: 200, headers: { 'content-type': 'text/plain' } }
    );
  }
};

// 从 KV 读取任务列表，KV 为空时使用默认任务
async function getTasks(env) {
  const json = await env.TASKS.get('tasks');
  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to parse tasks from KV:', e);
    }
  }
  return DEFAULT_TASKS;
}

// 执行所有任务
async function runAllTasks(env) {
  const tasks = await getTasks(env);
  const results = [];
  for (const task of tasks) {
    results.push({ task: task.tag, result: await barkPush(env, task) });
  }
  return results;
}

// Bark push 通知
async function barkPush(env, task) {
  if (!env.BARK_KEY) {
    return { status: 'error', reason: 'BARK_KEY secret not set' };
  }

  const params = new URLSearchParams(task.params);
  const url = `https://api.day.app/${env.BARK_KEY}/${encodeURIComponent(task.tag)}/${encodeURIComponent(task.body)}?${params}`;

  try {
    const res = await fetch(url);
    return { status: res.status, data: await res.json(), url };
  } catch (e) {
    return { status: 'error', reason: e.message, url };
  }
}
