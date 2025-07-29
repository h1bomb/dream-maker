'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { File, Terminal, Code, Eye, CheckCircle, XCircle, Settings, BarChart3 } from 'lucide-react';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
  raw_data?: string;
  message_type?: string;
}

interface ParsedSection {
  type: 'text' | 'file' | 'command' | 'code' | 'summary' | 'object' | 'error' | 'success' | 
        'system' | 'tool_use' | 'tool_result' | 'usage' | 'final_result';
  content: string;
  metadata?: any;
}

export function MessageContent({ content, role, raw_data, message_type }: MessageContentProps) {

  const parseRawData = (rawDataStr: string): ParsedSection[] => {
    try {
      const rawData = JSON.parse(rawDataStr);
      const sections: ParsedSection[] = [];
      
      if (Array.isArray(rawData)) {
        // Track session info for context
        // let sessionInfo = null;
        
        for (const msg of rawData) {
          // Handle system initialization message
          if (msg.type === 'system' && msg.subtype === 'init') {
            sections.push({
              type: 'system',
              content: '系统初始化',
              metadata: {
                cwd: msg.cwd,
                model: msg.model,
                tools: msg.tools?.length || 0,
                permissionMode: msg.permissionMode
              }
            });
            continue;
          }
          
          // Handle assistant messages
          if (msg.type === 'assistant' && msg.message?.content) {
            if (Array.isArray(msg.message.content)) {
              for (const contentItem of msg.message.content) {
                if (typeof contentItem === 'string') {
                  sections.push({ type: 'text', content: contentItem });
                } else if (contentItem && typeof contentItem === 'object') {
                  if (contentItem.type === 'text') {
                    sections.push({ type: 'text', content: contentItem.text });
                  } else if (contentItem.type === 'tool_use') {
                    sections.push({
                      type: 'tool_use',
                      content: `🔧 使用工具: ${contentItem.name}`,
                      metadata: { 
                        tool: contentItem.name, 
                        input: contentItem.input,
                        id: contentItem.id
                      }
                    });
                  } else {
                    sections.push({
                      type: 'object',
                      content: '🔧 执行了操作',
                      metadata: { data: contentItem }
                    });
                  }
                }
              }
            } else if (typeof msg.message.content === 'string') {
              sections.push({ type: 'text', content: msg.message.content });
            }
            
            // Add usage statistics if available
            if (msg.message.usage) {
              sections.push({
                type: 'usage',
                content: '使用统计',
                metadata: msg.message.usage
              });
            }
          }
          
          // Handle user messages (tool results)
          else if (msg.type === 'user' && msg.message?.content) {
            if (Array.isArray(msg.message.content)) {
              for (const contentItem of msg.message.content) {
                if (contentItem.type === 'tool_result') {
                  const isError = contentItem.is_error || contentItem.content?.includes('error');
                  sections.push({
                    type: isError ? 'error' : 'tool_result',
                    content: contentItem.content || '工具执行完成',
                    metadata: {
                      tool_use_id: contentItem.tool_use_id,
                      is_error: contentItem.is_error
                    }
                  });
                }
              }
            }
          }
          
          // Handle final result
          else if (msg.type === 'result') {
            sections.push({
              type: 'final_result',
              content: msg.result || '操作完成',
              metadata: {
                duration_ms: msg.duration_ms,
                duration_api_ms: msg.duration_api_ms,
                num_turns: msg.num_turns,
                total_cost_usd: msg.total_cost_usd,
                usage: msg.usage,
                session_id: msg.session_id
              }
            });
          }
        }
      }
      
      return sections;
    } catch (error) {
      console.error('Error parsing raw data:', error);
      return [];
    }
  };

  const parseContent = (content: string): ParsedSection[] => {
    const sections: ParsedSection[] = [];
    
    // First, handle the summary separator
    const summaryIndex = content.indexOf('--- Summary ---');
    let mainContent = content;
    let summaryContent = '';
    
    if (summaryIndex !== -1) {
      mainContent = content.substring(0, summaryIndex).trim();
      summaryContent = content.substring(summaryIndex + 15).trim();
    }
    
    // Split main content by double newlines, but preserve single newlines
    const parts = mainContent.split(/\n\n/);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      // Check for multiple [object Object] patterns
      if (part === '[object Object]') {
        sections.push({
          type: 'object',
          content: '🔧 执行了操作',
          metadata: { index: i }
        });
        continue;
      }

      // Check for sequences of [object Object]
      const objectMatches = part.match(/\[object Object\]/g);
      if (objectMatches && objectMatches.length > 1) {
        sections.push({
          type: 'object',
          content: `🔧 执行了 ${objectMatches.length} 个操作`,
          metadata: { count: objectMatches.length }
        });
        
        // Also include any text that's not [object Object]
        const textPart = part.replace(/\[object Object\]/g, '').trim();
        if (textPart) {
          sections.push({
            type: 'text',
            content: textPart,
          });
        }
        continue;
      }

      // Check for file paths
      if (part.includes('.html') || part.includes('.js') || part.includes('.css') || part.includes('.json')) {
        const fileMatch = part.match(/`([^`]+\.(html|js|css|json|ts|tsx))`/);
        if (fileMatch) {
          sections.push({
            type: 'file',
            content: part,
            metadata: { filePath: fileMatch[1], fileType: fileMatch[2] }
          });
          continue;
        }
      }

      // Check for command execution
      if (part.includes('执行') || part.includes('运行') || part.includes('命令')) {
        sections.push({
          type: 'command',
          content: part,
        });
        continue;
      }

      // Check for code blocks
      if (part.includes('```') || part.includes('function') || part.includes('class')) {
        sections.push({
          type: 'code',
          content: part,
        });
        continue;
      }

      // Check for success indicators
      if (part.includes('成功') || part.includes('完成') || part.includes('✅')) {
        sections.push({
          type: 'success',
          content: part,
        });
        continue;
      }

      // Check for error indicators
      if (part.includes('错误') || part.includes('失败') || part.includes('❌')) {
        sections.push({
          type: 'error',
          content: part,
        });
        continue;
      }

      // Default to text
      sections.push({
        type: 'text',
        content: part,
      });
    }

    // Add summary section if it exists
    if (summaryContent) {
      sections.push({
        type: 'summary',
        content: summaryContent,
      });
    }

    return sections;
  };

  const renderSection = (section: ParsedSection, index: number) => {

    switch (section.type) {
      case 'object':
        return (
          <Card key={index} className=" border-blue-200 bg-blue-50">
            <CardContent className="p-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-700 font-medium">{section.content}</span>
                {section.metadata?.count && (
                  <Badge variant="secondary" className="text-xs">
                    {section.metadata.count} 操作
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'file':
        const filePath = section.metadata?.filePath;
        const fileType = section.metadata?.fileType;
        return (
          <Card key={index} className="">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <File className="h-4 w-4" />
                <span className="font-medium">文件操作</span>
                {fileType && (
                  <Badge variant="secondary" className="text-xs">
                    {fileType.toUpperCase()}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="bg-muted p-3 rounded text-sm font-mono">
                {filePath && <div className="text-blue-600">{filePath}</div>}
                <div className="mt-1 text-muted-foreground">
                  {section.content.replace(/`[^`]+`/g, '').trim()}
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'command':
        return (
          <Card key={index} className=" border-orange-200">
            <CardContent className="p-3">
              <div className="flex items-start space-x-2">
                <Terminal className="h-4 w-4 mt-1 text-orange-600" />
                <div className="flex-1">
                  <div className="text-sm">{section.content}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'code':
        return (
          <Card key={index} className="">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4" />
                <span className="font-medium">代码</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                <code>{section.content}</code>
              </pre>
            </CardContent>
          </Card>
        );

      case 'summary':
        return (
          <Card key={index} className=" border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">总结</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm text-green-700">{section.content}</div>
            </CardContent>
          </Card>
        );

      case 'success':
        return (
          <div key={index} className="flex items-start space-x-2 py-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm text-green-700">{section.content}</div>
          </div>
        );

      case 'error':
        return (
          <div key={index} className="flex items-start space-x-2 py-2">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-700">{section.content}</div>
          </div>
        );

      case 'system':
        return (
          <Card key={index} className=" border-purple-200 bg-purple-50">
            <CardContent className="p-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm text-purple-700 font-medium">{section.content}</span>
                <Badge variant="secondary" className="text-xs">
                  {section.metadata?.model || 'Claude'}
                </Badge>
              </div>
              {section.metadata && (
                <div className="mt-2 text-xs text-purple-600 bg-white p-2 rounded">
                  <div><strong>目录:</strong> {section.metadata.cwd}</div>
                  <div><strong>工具数量:</strong> {section.metadata.tools}</div>
                  <div><strong>权限模式:</strong> {section.metadata.permissionMode}</div>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'tool_use':
        const renderToolParams = (params: any) => {
          if (!params || typeof params !== 'object') return null;
          
          return (
            <TooltipProvider>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(params).map(([key, value]) => {
                  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                  const truncatedValue = valueStr.length > 30 ? valueStr.substring(0, 30) + '...' : valueStr;
                  const needsTooltip = valueStr.length > 30;
                  
                  return (
                    <div key={key} className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-indigo-600">{key}:</span>
                      {needsTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-indigo-700 break-all cursor-help">
                              {truncatedValue}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <p className="text-xs break-all">{valueStr}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-indigo-700 break-all">
                          {valueStr}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          );
        };
        
        return (
          <Card key={index} className=" border-indigo-200 bg-indigo-50">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700">{section.content}</span>
                {section.metadata?.tool && (
                  <Badge variant="secondary" className="text-xs">
                    {section.metadata.tool}
                  </Badge>
                )}
              </div>
            </CardHeader>
            {section.metadata?.input && (
              <CardContent className="pt-0">
                <div className="bg-white p-3 rounded">
                  <div className="text-xs font-medium text-indigo-600 mb-2">参数:</div>
                  {renderToolParams(section.metadata.input)}
                </div>
              </CardContent>
            )}
          </Card>
        );

      case 'tool_result':
        return (
          <Card key={index} className=" border-green-200 bg-green-50">
            <CardContent className="p-3">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 mt-1 text-green-600" />
                <div className="flex-1">
                  <div className="text-sm text-green-700">{section.content}</div>
                  {section.metadata?.tool_use_id && (
                    <div className="text-xs text-green-600 mt-1">
                      工具ID: {section.metadata.tool_use_id}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'usage':
        const formatUsage = (metadata: any) => {
          if (!metadata) return '';
          
          const parts = [];
          if (metadata.input_tokens) parts.push(`输入: ${metadata.input_tokens.toLocaleString()}`);
          if (metadata.output_tokens) parts.push(`输出: ${metadata.output_tokens.toLocaleString()}`);
          if (metadata.cache_creation_input_tokens) parts.push(`缓存创建: ${metadata.cache_creation_input_tokens.toLocaleString()}`);
          if (metadata.cache_read_input_tokens) parts.push(`缓存读取: ${metadata.cache_read_input_tokens.toLocaleString()}`);
          
          return parts.join(' | ');
        };
        
        return (
          <Card key={index} className=" border-gray-200 bg-gray-50">
            <CardContent className="p-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Token 使用统计</span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {formatUsage(section.metadata)}
              </div>
            </CardContent>
          </Card>
        );

      case 'final_result':
        const formatStats = (metadata: any) => {
          if (!metadata) return '';
          
          const parts = [];
          if (metadata.duration_ms) parts.push(`耗时: ${(metadata.duration_ms / 1000).toFixed(1)}s`);
          if (metadata.num_turns) parts.push(`轮次: ${metadata.num_turns}`);
          if (metadata.total_cost_usd) parts.push(`费用: $${metadata.total_cost_usd.toFixed(4)}`);
          
          return parts.join(' | ');
        };
        
        return (
          <Card key={index} className=" border-emerald-200 bg-emerald-50">
            <CardContent className="p-3">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">任务完成</span>
              </div>
              <div className="text-sm text-emerald-700 mb-2">{section.content}</div>
              {section.metadata && (
                <div className="text-xs text-emerald-600">
                  {formatStats(section.metadata)}
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return (
          <div key={index} className="text-sm py-1 whitespace-pre-wrap">
            {section.content}
          </div>
        );
    }
  };

  if (role === 'user') {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  // If we have raw data from Claude Code SDK, use it for better parsing
  let sections: ParsedSection[] = [];
  if (raw_data && message_type === 'claude_code_response') {
    sections = parseRawData(raw_data);
    
    // If raw data parsing didn't yield enough content, fall back to content parsing
    if (sections.length === 0 || sections.every(s => s.content.trim().length < 10)) {
      sections = parseContent(content);
    }
  } else {
    sections = parseContent(content);
  }

  return (
    <div className="space-y-3">
      {sections.map((section, index) => renderSection(section, index))}
    </div>
  );
}