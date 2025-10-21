# 迁移到 Anthropic Claude Agent SDK（执行记录与待办）

本文档记录从 `@anthropic-ai/claude-code` 迁移到 `@anthropic-ai/claude-agent-sdk` 的步骤、当前仓库已完成的改动以及后续需要在开发机或 CI 环境执行的操作。

更新时间：2025-10-21

---

## 一、迁移任务清单（TODO）

- [x] 引入 SDK 适配器（src/lib/agent-sdk.ts）：运行时优先加载 `@anthropic-ai/claude-agent-sdk`，若不可用则回退到 `@anthropic-ai/claude-code`。
- [x] 代码层替换直接依赖：
  - [x] `src/lib/claude.ts` 改为从适配器导入 `query` 与 `SDKMessage`。
  - [x] `src/components/chat/chat-interface.tsx` 改为从适配器导入 `SDKMessage` 类型。
- [x] 在使用 Agent SDK 时显式对齐行为：
  - [x] `systemPrompt` 设为 `{ type: 'preset', preset: 'claude_code' }` 以保持与旧版相同的系统提示。
  - [x] `settingSources` 设为空数组 `[]`，避免默认从文件系统加载设置，保持可预测性。
- [x] 文档更新：
  - [x] `CLAUDE.md`：将“Claude Code SDK”更新为“Agent SDK via adapter”，并更新示例导入路径为 `@/lib/agent-sdk`。
  - [x] `docs/PROJECT_DESIGN.md`：更新技术栈、架构说明与术语。
  - [x] README：添加项目设计文档入口。
- [ ] 包管理与安装（需要本地/CI 执行）：
  - [ ] 在本地或 CI 中执行：`npm uninstall @anthropic-ai/claude-code`。
  - [ ] 执行：`npm install @anthropic-ai/claude-agent-sdk`。
  - [ ] 验证：`npm run typecheck && npm run lint`。
  - [ ] 运行开发环境验证主要流程：创建 App → 自动发首条消息 → 生成文件 → 查看代码树 → 启动预览。
- [ ] 清理（可选）：当新包验证稳定后，考虑移除适配器中的回退逻辑，仅保留 `@anthropic-ai/claude-agent-sdk`。

---

## 二、当前仓库已完成的改动

1) 新增适配器：`src/lib/agent-sdk.ts`

- 在运行时优先 `require('@anthropic-ai/claude-agent-sdk')`，若失败则回退到 `@anthropic-ai/claude-code`。
- 对外导出：
  - `query(args)`：与原有 SDK 一致的查询接口（异步可迭代）。
  - `SDKMessage`：宽松类型别名，避免编译期卡死。
  - `isAgentSDK`：指示当前是否使用新包。

2) 业务封装：`src/lib/claude.ts`

- 导入改为 `@/lib/agent-sdk`。
- 对 `createMessage` 与 `streamMessage`：
  - 保持 `maxTurns` 与 `permissionMode: 'bypassPermissions'` 原有行为；
  - 若 `isAgentSDK === true`：
    - `systemPrompt = { type: 'preset', preset: 'claude_code' }`
    - `settingSources = []`
  - 仍支持 `cwd` 注入工作目录提示与 `continue` 选项。

3) 组件类型：`src/components/chat/chat-interface.tsx`

- 从适配器导入 `SDKMessage` 类型以保持一致。

4) 文档更新：

- `CLAUDE.md`：
  - “Claude Code SDK Integration” → “Agent SDK Integration”。
  - 示例导入改为：`import { query, type SDKMessage } from "@/lib/agent-sdk"`。
  - 依赖章节说明采用“优先 Agent SDK、回退 Code SDK”。
- `docs/PROJECT_DESIGN.md`：
  - 技术栈/架构/第三方 SDK 部分更新为 Agent SDK（经适配器）。
  - ClaudeClient 小节新增 Agent SDK 下的 `systemPrompt/settingSources` 行为说明。
- `README.md`：新增设计文档链接。

---

## 三、后续执行与验证建议

1) 在本地切换到新包

```bash
npm uninstall @anthropic-ai/claude-code
npm install @anthropic-ai/claude-agent-sdk
npm run typecheck
npm run lint
npm run dev
```

2) 冒烟测试

- 首页输入需求创建 App，检查：
  - 是否自动发送首条消息；
  - 工作目录是否生成文件；
  - 消息流解析（assistant/result）是否正常；
- 在工作区：
  - 打开 Code Viewer 查看文件树/内容；
  - 启动 Preview，是否给出本地 URL 并可访问；
- 观察后台日志：
  - 是否打印 `isAgentSDK === true` 的行为（systemPrompt 等）；
  - 是否有 SDK 报错或权限问题。

3) 渐进清理

- 确认新包稳定后，可移除适配器中的回退逻辑；
- 更新 `CLAUDE.md` 与设计文档，删去回退说明；
- 若需要，可对 `SDKMessage` 引入更严格的类型定义（来自新包）。

---

## 四、常见问题

- Q：未安装新包是否可运行？
  - A：可以。适配器会回退到 `@anthropic-ai/claude-code`，保障开发环境可用。
- Q：是否必须设置 `systemPrompt`？
  - A：Agent SDK 默认不带 Claude Code 的系统提示。为获得旧体验已在封装中显式设置 `preset: 'claude_code'`。
- Q：是否需要 `settingSources`？
  - A：为保持可预测性，默认关闭从文件系统读取设置（`[]`）。如需旧行为，可设置为 `["user","project","local"]`。
