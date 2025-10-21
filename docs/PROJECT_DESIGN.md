# Dream Maker 项目设计文档（详细版）

本文面向参与 Dream Maker 的产品、前端、后端与基础设施工程师，系统性阐述项目的目标、架构、核心模块、数据模型、接口协议、运行机制、质量保障与后续演进规划，便于高效协作与快速迭代。

- 更新时间：2025-10-21
- 技术栈：Next.js 15（App Router）+ React 19 + TypeScript + Tailwind + shadcn/ui + Anthropic Claude Agent SDK（通过适配器，优先新包，回退老包）
- 运行时：Node.js（使用 Next.js Node runtime；依赖 Node 标准库、child_process、fs、sqlite3）

---

## 1. 项目目标与价值

Dream Maker 是一个围绕 Anthropic Agent SDK 的 AI Agent 平台（通过适配器兼容 Claude Code SDK）：
- 允许用户用自然语言创建/迭代 Web 应用或代码项目；
- 以多轮对话驱动 Agent 在本地工作目录内生成/修改文件；
- 在浏览器侧提供工作空间（Workspace）体验：聊天、历史记录、代码浏览、站点预览。

主要价值：
- 降低原型开发门槛，让“从想法到可运行代码”的链路更短；
- 以最小配置提供端到端体验（无云端依赖、无需 API Key）；
- 为扩展更多 Agent 能力（插件/工具、Workflows、评估）提供基础设施。

---

## 2. 架构总览

前后端一体化，Next.js App Router 承载页面与 API 路由：

- 前端（App Router + 客户端组件）：
  - 首页：输入需求，创建 App 实例
  - 工作区 /app/[id]：聊天、消息流、代码树浏览、文件内容查看、站点预览
  - 通用 UI：shadcn/ui + Tailwind，暗色主题变量

- 服务层（Next.js Route Handlers）：
  - Chat 通过适配器调用 Anthropic Agent SDK（封装于 src/lib/claude.ts，经由 src/lib/agent-sdk.ts 选择新/旧包）
  - Apps CRUD、Messages 存取
  - 文件树/文件内容读取
  - 本地预览服务（child_process）生命周期管理

- 存储层（本地）：
  - SQLite 数据库：~/.dream-maker/dream-maker.db
  - 应用工作目录：~/.dream-maker/<app-id>/（Claude 写入/修改文件的地方）

- 第三方 SDK：
  - Anthropic Agent SDK（优先 @anthropic-ai/claude-agent-sdk，回退 @anthropic-ai/claude-code；无需配置 API Key）

数据与调用流（典型创建流程）：
1) 用户在首页输入需求 → POST /api/apps 创建 App，并生成工作目录；
2) 跳转 /app/[id]?prompt=... → 初始化加载 App/历史消息/文件状态；
3) 若目录空且带 prompt，自动将 prompt 发送给 Claude（携带 cwd）；
4) Claude 按多轮对话生成代码写入工作目录；
5) 前端解析 SDK 消息，保存简要/原始消息到 DB；
6) 用户可查看代码树与文件，或启动本地预览服务。

---

## 3. 目录结构与关键文件

```
src/
├── app/
│   ├── page.tsx                 # 首页：创建 App
│   ├── layout.tsx               # 根布局
│   ├── globals.css              # Tailwind & 主题变量
│   ├── app/[id]/page.tsx        # 工作区（聊天/代码/预览）
│   └── api/
│       ├── chat/route.ts        # Chat → Claude SDK
│       ├── apps/route.ts        # GET:按用户列出 / POST:创建 App
│       ├── apps/[id]/route.ts   # GET:获取 App
│       ├── apps/[id]/messages/route.ts  # GET/POST 消息
│       ├── apps/[id]/files/route.ts     # GET:是否已有文件
│       ├── files/tree/route.ts  # POST:获取目录树
│       ├── files/content/route.ts# POST:读取文件内容
│       ├── preview/route.ts     # POST:预览服务 start/stop/status
│       └── users/route.ts       # POST:创建用户（本地 ID 注册）
├── components/
│   ├── chat/chat-interface.tsx  # 独立 Chat 组件（演示/测试）
│   ├── code-viewer.tsx          # 代码树 + 文件内容侧栏
│   ├── message-content.tsx      # 智能解析/渲染 Claude 消息
│   └── ui/                      # shadcn/ui 基础组件
└── lib/
    ├── claude.ts                # Claude SDK 封装（query 循环）
    ├── server-database.ts       # SQLite 封装 + 表/迁移 + App 目录
    ├── app-manager.ts           # 客户端 userId 管理（localStorage）
    └── utils.ts                 # cn() 工具
```

相关根级文件：
- package.json：Next 15、React 19、sqlite3、tailwind 等依赖
- tsconfig.json：strict、路径别名 @/* → ./src/*
- tailwind.config.ts：CSS 变量与动画、组件扫描
- CLAUDE.md：给 AI 协作者的开发指南

---

## 4. 数据模型与存储

SQLite 数据库位于 ~/.dream-maker/dream-maker.db，首次通过 /api/init 初始化。

表结构（server-database.ts 创建/迁移）：
- users
  - id TEXT PRIMARY KEY
  - created_at DATETIME DEFAULT CURRENT_TIMESTAMP

- apps
  - id TEXT PRIMARY KEY
  - user_id TEXT NOT NULL
  - name TEXT NOT NULL
  - description TEXT
  - directory_path TEXT NOT NULL   ← 工作目录绝对路径
  - created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  - updated_at DATETIME DEFAULT CURRENT_TIMESTAMP

- messages
  - id TEXT PRIMARY KEY
  - app_id TEXT NOT NULL
  - role TEXT CHECK IN ('user','assistant')
  - content TEXT NOT NULL
  - raw_data TEXT NULL             ← 保存 Claude SDK 原始消息数组（JSON 字符串）
  - message_type TEXT DEFAULT 'text'（例如 'claude_code_response'）
  - created_at DATETIME DEFAULT CURRENT_TIMESTAMP

迁移策略：每次启动会检查 messages 表是否存在 raw_data/message_type 字段，若缺失则 ALTER TABLE 增加。迁移异常不阻塞应用（仅日志）。

工作目录：ServerAppManager.createAppDirectory 会在 ~/.dream-maker/<app-id> 创建目录，用于 Claude 读写文件。

---

## 5. 核心模块设计

### 5.1 ClaudeClient（src/lib/claude.ts）

- 作用：通过适配器（src/lib/agent-sdk.ts）封装 query()，优先使用 @anthropic-ai/claude-agent-sdk，若不可用回退到 @anthropic-ai/claude-code；提供 createMessage 与 streamMessage 两种模式；
- 关键选项：
  - maxTurns：默认 100（界面默认 3～10 可覆盖）
  - permissionMode：固定 'bypassPermissions'（允许 SDK 工具直接操作本地文件）
  - cwd：设置为 App 的工作目录；若设置，则会在 prompt 前添加中文引导，强调在该目录内创建文件
  - continue：是否续写对话（SDK 选项）
  - 若使用 Agent SDK：显式设置 systemPrompt 为 { type: 'preset', preset: 'claude_code' }，并禁用 settingSources（[]）以保持可预测性
- 处理流程：
  - for await 循环消费 SDK 响应流，将每条 SDKMessage 推入数组；
  - 控制台记录关键信息，便于前端解析与调试；
  - 返回 { messages, success: true }。

### 5.2 AppManager（src/lib/app-manager.ts）

- 作用：客户端生成/缓存 userId 到 localStorage，并调用 /api/users 在 DB 侧注册；
- 约束：仅浏览器端可调用（window 可用时）。

### 5.3 ServerDatabase & ServerAppManager（src/lib/server-database.ts）

- ServerDatabase：封装 sqlite3 连接、建表、迁移、CRUD；所有 API 路由在处理前调用 init() 保障数据库存在；
- ServerAppManager：在创建 App 时顺带创建工作目录，并写入 apps 表。

---

## 6. API 设计（Route Handlers）

所有接口均为 Next.js App Router 下的文件路由，Node runtime，JSON 返回。

- POST /api/init
  - 功能：初始化数据库（建表+迁移）
  - 入参：无
  - 出参：{ success: true }

- POST /api/users
  - 功能：在 DB 中注册本地 userId
  - 入参：{ userId }
  - 出参：{ success: true }

- GET /api/apps?userId=xxx
  - 功能：按用户列出 Apps（按 updated_at DESC）
  - 出参：{ apps: App[] }

- POST /api/apps
  - 功能：创建 App（含工作目录），name 取前 50 字符
  - 入参：{ userId, name, description }
  - 出参：{ appId, directory, success }

- GET /api/apps/[id]
  - 功能：获取 App 详情
  - 出参：{ app }

- GET /api/apps/[id]/messages
  - 功能：获取该 App 的消息按时间升序
  - 出参：{ messages: Message[] }

- POST /api/apps/[id]/messages
  - 功能：新增消息；去重策略：若相同 role+content 已存在则返回 duplicate=true
  - 入参：{ role, content, raw_data?, message_type? }
  - 出参：{ messageId, success, duplicate }

- GET /api/apps/[id]/files
  - 功能：检查工作目录是否已有可见文件（忽略隐藏和目录）
  - 出参：{ hasFiles, fileCount, directory }

- POST /api/files/tree
  - 功能：根据 directory 构建文件树（忽略隐藏与 node_modules）
  - 入参：{ directory }
  - 出参：{ tree: FileNode[] }

- POST /api/files/content
  - 功能：读取文件内容（限制 1MB，拒绝目录与二进制）
  - 入参：{ filePath }
  - 出参：{ content } 或错误

- POST /api/chat
  - 功能：把用户请求转发给 ClaudeClient.createMessage
  - 入参：{ message, appId?, cwd?, continue? }
  - 行为：若带 cwd，会给 prompt 注入“请在工作目录 ${cwd} 中工作”提示
  - 出参：{ response: { messages: SDKMessage[], success: true } }

- POST /api/preview
  - 功能：本地开发预览服务生命周期管理
  - 入参：{ appDirectory, action: 'start'|'stop'|'status' }
  - 行为：
    - start：从 3001 起寻找可用端口；若无 package.json → 使用 `npx serve -s . -p <port>`；否则优先 `npm run dev` 再 `npm start`；记录 child_process 与端口；返回 url
    - stop：SIGTERM 结束对应子进程
    - status：查询是否在运行

安全注意：preview 路由与 files 路由均在 Node runtime 下运行，具备文件系统访问能力；请勿部署到无隔离/不可信环境。

---

## 7. 前端页面与组件

### 7.1 首页（src/app/page.tsx）
- 进入即调用 /api/init 与 AppManager.initializeUser 完成 DB 初始化与用户注册；
- 提交表单后创建 App，并跳转 /app/[id]?prompt=...。

### 7.2 工作区（src/app/app/[id]/page.tsx）
- 初始化：
  - 加载当前 App、用户所有 Apps、该 App 的历史消息
  - 检查工作目录是否已有文件（hasFiles）
  - 若带 URL prompt 且目录为空且消息为空 → 自动发送首条消息给 Claude（携带 cwd）
- 消息发送：
  - 先将 user 消息保存至 DB
  - 调用 /api/chat，并将 Claude 返回的 SDKMessage[]：
    - 提取所有 type='assistant' 的 message.content，拼接为 content
    - 提取所有 type='result' 的 result，作为“--- Summary ---”后缀
  - 保存 assistant 消息至 DB：
    - content：拼接后的可读文本
    - raw_data：完整 SDKMessage[] JSON 字符串
    - message_type：'claude_code_response'
- 其它功能：
  - 代码浏览（CodeViewer）：读取树与文件内容
  - 预览启动：调用 /api/preview start，返回 URL 并新窗口打开

### 7.3 ChatInterface（src/components/chat/chat-interface.tsx）
- 独立的简化聊天体验（用于演示/测试）；
- 支持 Max Turns 设置，基本同上但未与 App 工作目录绑定。

### 7.4 MessageContent（src/components/message-content.tsx）
- 对 Claude 返回的文本与原始 SDK 数据进行“结构化分段渲染”：
  - 优先 parseRawData(raw_data)：根据 SDK 消息类型（system/init、assistant/tool_use、user/tool_result、result/usage）生成卡片/列表
  - 若原始解析不足，再 parseContent(content) 做启发式拆分（Summary、代码块、命令、文件路径、成功/错误提示等）
- 视觉：通过 shadcn/ui Card + Icon（lucide-react）表达不同语义；对于过长的键值对使用 Tooltip 折叠。

### 7.5 CodeViewer（src/components/code-viewer.tsx）
- 侧边 Sheet 显示目录树，可展开/折叠；
- 文件点击读取内容（限制 1MB），自动设置语言高亮类别（基础映射）。

---

## 8. 错误处理与健壮性

- API 均包裹 try/catch，统一返回 { error, status }；
- 消息写入做重复检测（role+content）避免刷屏；
- 文件读取限制体积与二进制；
- 预览子进程异常/退出均清理运行表；
- 前端对异常给予用户友好文案与 Loading 状态管理。

---

## 9. 安全与权限

- ClaudeClient 将 permissionMode 设为 bypassPermissions，便于 SDK 工具修改本地文件，仅用于本地开发环境；
- 文件 API 当前按传入路径直接访问，安全加固建议：
  - 校验 filePath 必须位于当前 App 的 directory_path 之下（路径归一化 + 前缀判断）；
  - 白名单可读类型（.js/.ts/.html/.css/.json 等）；
  - 对 /api/preview、/api/files/* 增加 AppId 上下文校验，避免越权访问。

---

## 10. 性能与可扩展性

- Next.js 开发模式开启 Turbo；
- 组件按需渲染，文件树过滤隐藏与 node_modules；
- Agent SDK 支持流式（streamMessage 已预留），后续可接入前端流式渲染；
- 本地 SQLite 足以覆盖单机体验；后续可抽象 DB 层支持 Postgres 等；
- 预览服务端口从 3001 顺延，避免与主站 3000 冲突。

---

## 11. 部署与运行

- 本项目依赖 Node runtime（使用 fs、child_process、sqlite3），不适合 Edge/Serverless 无持久化环境；
- 生产运行需具备写权限的主机（用于 ~/.dream-maker 与数据库/工作目录）；
- 启动：
  - 开发：npm run dev
  - 生产：npm run build && npm run start

---

## 12. 开发规范与代码风格

- TypeScript 严格模式、路径别名 @/*；
- 组件遵循 shadcn/ui 模式，样式用 Tailwind + CSS 变量；
- 提交前必须通过：npm run typecheck、npm run lint；
- UI 类合并统一使用 cn() 工具（src/lib/utils.ts）。

---

## 13. 测试策略（建议）

- 单元测试：
  - lib 层（claude.ts：参数拼装、错误抛出；server-database：迁移与 CRUD 假造 sqlite 接口）
- 接口集成测试：
  - 使用 Next 测试工具对 /api/apps、/api/chat、/api/files/*、/api/preview 进行请求-响应校验；
  - Mock fs/child_process 以避免真实 IO；
- 端到端（可选）：
  - 使用 Playwright：创建 App → 自动发首条消息 → 生成文件 → 查看代码树 → 启动预览。

---

## 14. 监控与日志（建议）

- 现状：以 console.log 为主（SDK 消息简要、API 入参与错误）；
- 规划：
  - 引入轻量日志库（如 pino）按级别输出；
  - 关键路径（创建/保存消息、启动/退出预览）埋点。

---

## 15. 已知限制与风险

- 安全：files/content 可读取任意路径；preview 可执行工作目录脚本；仅限本地可信运行；
- 兼容性：依赖 sqlite3 原生模块与 Node API，需合适的运行环境；
- 体验：目前非流式显示；复杂 tool_use 的 UI 表达仍可增强；
- 多用户：以 localStorage userId 区分，未做登录鉴权与服务端隔离。

---

## 16. 演进路线图

短期（1-2 周）：
- [安全] 限制文件访问与路径校验，绑定 appId 上下文
- [体验] 前端接入流式渲染（streamMessage）与进度提示
- [可视化] CodeViewer 语法高亮、Diff 视图
- [稳定] 预览服务健康探测、自动重启

中期（3-6 周）：
- [能力] 支持多 Agent/多模型与参数面板
- [协作] Web 编辑器（在线微改 + 一键提交变更到 FS）
- [存储] DB 抽象与可插拔后端（Postgres/SQLite）
- [评估] 任务模板与自动验收（结果断言/回归数据）

长期（>6 周）：
- 插件化工具体系（Git、HTTP、DB、云资源）
- 账号与权限体系、团队协作、多工作区管理
- 云端运行沙箱（隔离 FS/进程）

---

## 17. 开放问题与决策记录

- 权限模型：是否保持 bypassPermissions（本地便利）或引入显式白名单？
- 运行环境：是否支持跨平台（Windows/Mac/Linux）的最小依赖打包？
- SDK 升级：关注 Anthropic Agent SDK 版本变更及与 Claude Code SDK 的兼容性（消息结构/工具接口变化）。

---

## 18. 附录：关键代码片段

- Claude SDK 调用模式：
```ts
for await (const message of query({
  prompt,
  abortController,
  options: { maxTurns, permissionMode: 'bypassPermissions', cwd, continue },
})) {
  messages.push(message)
}
```

- 前端消息解析（优先 assistant，回退 result）：
```ts
const assistantMessages = sdkMessages.filter(m => m.type === 'assistant')
let content = assistantMessages
  .map(m => Array.isArray(m.message?.content)
    ? m.message.content.map(c => typeof c === 'string' ? c : c?.text ?? '').join('\n')
    : m.message?.content?.toString?.() ?? ''
  )
  .filter(Boolean)
  .join('\n\n')

const resultMessages = sdkMessages.filter(m => m.type === 'result')
for (const r of resultMessages) {
  if (r.result && typeof r.result === 'string' && r.result.trim()) {
    content += (content ? '\n\n--- Summary ---\n' : '') + r.result
  }
}
```

---

如需快速上手，请结合仓库根目录的 README.md 与 CLAUDE.md；本设计文档为整体蓝图与决策依据，新增模块或重大改动请在此维护记录。
