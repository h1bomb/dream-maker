'use client';

import { MessageContent } from './message-content';

const testMessages = [
  {
    role: 'assistant' as const,
    content: `我将在指定目录创建一个简单的任务管理应用HTML文件。

[object Object]

[object Object]

[object Object]

任务管理应用已成功创建在 \`/Users/mingzhe/.dream-maker/f8bd3d40-dd92-4fb4-ad57-c4ed32fbd5c7/task-manager.html\`

该应用包含以下功能：
- 添加、删除、完成任务
- 优先级设置（高/中/低）
- 任务统计
- 本地存储
- 响应式设计

--- Summary ---
任务管理应用已成功创建在 \`/Users/mingzhe/.dream-maker/f8bd3d40-dd92-4fb4-ad57-c4ed32fbd5c7/task-manager.html\`

该应用包含以下功能：
- 添加、删除、完成任务
- 优先级设置（高/中/低）
- 任务统计
- 本地存储
- 响应式设计`
  },
  {
    role: 'assistant' as const,
    content: `[object Object]

目录中已存在两个任务管理应用：
- \`task-manager.html\` - 功能完整的任务管理应用（含优先级设置）
- \`simple-task-manager.html\` - 简单版任务管理应用

您可以直接使用其中任意一个HTML文件，它们都具备完整的任务管理功能。

--- Summary ---
目录中已存在两个任务管理应用：
- \`task-manager.html\` - 功能完整的任务管理应用（含优先级设置）
- \`simple-task-manager.html\` - 简单版任务管理应用

您可以直接使用其中任意一个HTML文件，它们都具备完整的任务管理功能。`
  }
];

export function MessageTest() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">消息组件测试</h1>
      
      {testMessages.map((message, index) => (
        <div key={index} className="border rounded-lg p-4 bg-muted">
          <div className="text-sm text-muted-foreground mb-2">
            测试消息 {index + 1} - {message.role}
          </div>
          <MessageContent content={message.content} role={message.role} />
        </div>
      ))}
    </div>
  );
}