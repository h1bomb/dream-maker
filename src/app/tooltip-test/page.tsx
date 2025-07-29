'use client';

import { MessageContent } from '@/components/message-content';

const sampleToolUseData = [
  {
    type: "system",
    subtype: "init",
    cwd: "/Users/mingzhe/.dream-maker/47e63671-1564-4fd8-a225-66018e6f9ec9",
    session_id: "b9e9364d-d568-4004-9244-bbc54a883cdf",
    tools: ["Task", "Bash", "Glob", "Grep", "LS", "ExitPlanMode", "Read", "Edit", "MultiEdit", "Write"],
    model: "claude-sonnet-4-20250514",
    permissionMode: "bypassPermissions"
  },
  {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "toolu_01TGBhuXsTxqjAfsWi9F7QWD",
          name: "Write",
          input: {
            file_path: "/Users/mingzhe/.dream-maker/47e63671-1564-4fd8-a225-66018e6f9ec9/index.html",
            content: "<!DOCTYPE html><html><head><title>这是一个非常非常长的标题，用来测试tooltip功能是否正常工作</title></head><body><h1>测试页面</h1></body></html>",
            encoding: "utf-8",
            permissions: "644"
          }
        }
      ],
      usage: {
        input_tokens: 3,
        cache_creation_input_tokens: 15982,
        cache_read_input_tokens: 0,
        output_tokens: 2587
      }
    }
  },
  {
    type: "result",
    duration_ms: 39358,
    duration_api_ms: 38675,
    num_turns: 4,
    total_cost_usd: 0.12459285,
    result: "文件创建成功"
  }
];

export default function TooltipTestPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 compact">
      <h1 className="text-2xl font-bold">Tooltip 功能测试</h1>
      
      <div className="border rounded-lg p-4 bg-muted">
        <div className="text-sm text-muted-foreground mb-4">
          测试键值对展示：每行最多2个，长内容显示tooltip
        </div>
        <MessageContent 
          content="工具使用测试" 
          role="assistant"
          raw_data={JSON.stringify(sampleToolUseData)}
          message_type="claude_code_response"
        />
      </div>
      
      <div className="text-sm text-muted-foreground">
        <p>测试说明：</p>
        <ul className="list-disc ml-4 mt-2 space-y-1">
          <li>键值对应该以2列网格布局显示</li>
          <li>超过30字符的值应该被截断并显示&quot;...&quot;</li>
          <li>鼠标悬停在截断的内容上应该显示完整的tooltip</li>
          <li>短内容不应该有tooltip</li>
        </ul>
      </div>
    </div>
  );
}