'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Settings, Home } from 'lucide-react';

import { type SDKMessage } from "@/lib/agent-sdk";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sdkMessages?: SDKMessage[];
}

interface ChatInterfaceProps {
  initialPrompt?: string;
  onBackToHome?: () => void;
}

export function ChatInterface({ initialPrompt, onBackToHome }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [maxTurns, setMaxTurns] = useState(3);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 自动发送初始提示
  useEffect(() => {
    if (initialPrompt) {
      sendMessageWithText(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const sendMessageWithText = async (messageText: string) => {
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          maxTurns,
        }),
      });

      const data = await response.json();
      console.log('API Response:', data); // 调试信息

      if (data.response && data.response.messages) {
        const sdkMessages = data.response.messages;
        
        // 查找 assistant 类型的消息
        const assistantMsg = sdkMessages.find((msg: any) => msg.type === 'assistant');
        
        let content = '';
        if (assistantMsg && assistantMsg.message && assistantMsg.message.content) {
          if (Array.isArray(assistantMsg.message.content)) {
            content = assistantMsg.message.content
              .map((c: any) => c.text || c.toString())
              .join('\n');
          } else {
            content = assistantMsg.message.content.toString();
          }
        }
        
        // 如果没有找到 assistant 消息，尝试从 result 消息中获取
        if (!content) {
          const resultMsg = sdkMessages.find((msg: any) => msg.type === 'result');
          if (resultMsg && resultMsg.result) {
            content = resultMsg.result;
          }
        }

        if (content) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content,
            timestamp: new Date(),
            sdkMessages,
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          // 如果无法提取内容，显示错误信息
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Sorry, I could not process the response properly.',
            timestamp: new Date(),
            sdkMessages,
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // 如果API响应格式不正确
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Error: Invalid response from API.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // 显示网络错误信息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error: Failed to send message. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    await sendMessageWithText(input);
  };

  return (
    <div className="mx-auto p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dream Maker AI Agent</CardTitle>
          <div className="flex gap-2">
            {onBackToHome && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToHome}
              >
                <Home className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSettings && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Turns</label>
              <Input
                type="number"
                placeholder="Maximum conversation turns"
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                min={1}
                max={10}
              />
              <p className="text-xs text-muted-foreground">
                Number of conversation turns Claude can take (1-10)
              </p>
            </div>
          )}

          <div className="space-y-4 h-96 overflow-y-auto border rounded-lg p-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground">
                Start a conversation with Claude Code SDK
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-3xl rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <div className="animate-pulse">Claude is thinking...</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Type your message here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}