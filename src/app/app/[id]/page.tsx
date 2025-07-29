'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, Code, Eye, Home, FolderOpen, Plus } from 'lucide-react';
import { AppManager } from '@/lib/app-manager';
import { CodeViewer } from '@/components/code-viewer';
import { MessageContent } from '@/components/message-content';
import { v4 as uuidv4 } from 'uuid';

interface App {
  id: string;
  user_id: string;
  name: string;
  description: string;
  directory_path: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  app_id: string;
  role: 'user' | 'assistant';
  content: string;
  raw_data?: string;
  message_type?: string;
  created_at: string;
}

interface AppPageMessage extends Message {
  timestamp: Date;
}

export default function AppPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const appId = params.id as string;
  const initialPrompt = searchParams.get('prompt');

  const [messages, setMessages] = useState<AppPageMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [currentApp, setCurrentApp] = useState<App | null>(null);
  const [showCodeViewer, setShowCodeViewer] = useState(false);
  const [appHasFiles, setAppHasFiles] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createInput, setCreateInput] = useState('');

  useEffect(() => {
    // Reset initialization state when appId changes
    setIsInitializing(true);
    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  useEffect(() => {
    // Wait for initialization to complete before making any decisions
    if (isInitializing) {
      console.log('Still initializing, waiting...');
      return;
    }

    // Only auto-send initial prompt if:
    // 1. There's an initial prompt from URL
    // 2. No messages exist yet  
    // 3. Current app is loaded
    // 4. App has NO files (meaning it's a fresh app)
    // 5. Initialization is complete
    if (initialPrompt && messages.length === 0 && currentApp && !appHasFiles) {
      console.log('Auto-sending initial prompt because app has no files yet');
      sendMessageWithText(initialPrompt);
    } else if (initialPrompt && currentApp && appHasFiles) {
      console.log('App already has files - skipping auto-send completely');
    } else if (currentApp && appHasFiles) {
      console.log('App already created - ready for user input');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, messages.length, currentApp, appHasFiles, isInitializing]);

  const initializeApp = async () => {
    try {
      const userId = AppManager.getUserId();
      
      // Load current app
      const appResponse = await fetch(`/api/apps/${appId}`);
      if (appResponse.ok) {
        const appData = await appResponse.json();
        console.log('Loaded current app:', appData.app);
        setCurrentApp(appData.app || null);
      } else {
        console.error('Failed to load app:', appResponse.status);
      }
      
      // Load user's apps
      const appsResponse = await fetch(`/api/apps?userId=${userId}`);
      if (appsResponse.ok) {
        const appsData = await appsResponse.json();
        setApps(appsData.apps || []);
      }
      
      // Load app messages
      const messagesResponse = await fetch(`/api/apps/${appId}/messages`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const formattedMessages = (messagesData.messages || []).map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.created_at)
        }));
        
        // Remove duplicate messages based on content and role
        const uniqueMessages = formattedMessages.filter((message: AppPageMessage, index: number, array: AppPageMessage[]) => {
          return array.findIndex((m: AppPageMessage) => 
            m.content === message.content && 
            m.role === message.role
          ) === index;
        });
        
        console.log(`Loaded ${formattedMessages.length} messages, after dedup: ${uniqueMessages.length}`);
        setMessages(uniqueMessages);
      }

      // Check if app already has files
      const filesResponse = await fetch(`/api/apps/${appId}/files`);
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        console.log('App files check:', filesData);
        setAppHasFiles(filesData.hasFiles || false);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      // Mark initialization as complete regardless of success or failure
      console.log('Initialization complete');
      setIsInitializing(false);
    }
  };

  const sendMessageWithText = async (messageText: string) => {
    console.log('sendMessageWithText called with:', { messageText, currentApp: !!currentApp });
    
    if (!messageText.trim() || !currentApp) {
      console.log('Early return: messageText empty or currentApp not available');
      return;
    }

    // Check if this exact message already exists
    const existingMessage = messages.find(msg => 
      msg.content === messageText && msg.role === 'user'
    );
    
    if (existingMessage) {
      console.log('Message already exists, skipping send:', messageText);
      return;
    }

    const userMessage: AppPageMessage = {
      id: uuidv4(),
      app_id: appId,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Save user message to database
      await fetch(`/api/apps/${appId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'user',
          content: messageText
        }),
      });

      // Send to Claude with app directory as cwd
      console.log('Sending to Claude API with:', {
        message: messageText,
        appId,
        cwd: currentApp.directory_path,
        continue: true
      });
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `请在当前目录创建一个简单的HTML文件。目录路径是：${currentApp.directory_path}。\n\n用户请求：${messageText}`,
          appId,
          cwd: currentApp.directory_path,
          continue: true
        }),
      });

      const data = await response.json();
      console.log('Received response from API:', data);

      if (data.response && data.response.messages) {
        const sdkMessages = data.response.messages;
        console.log('All SDK messages:', sdkMessages.map((msg: any) => ({ type: msg.type, hasContent: !!msg.message?.content, hasResult: !!msg.result })));
        
        // Collect all assistant messages and their content
        const assistantMessages = sdkMessages.filter((msg: any) => msg.type === 'assistant');
        console.log('Found assistant messages count:', assistantMessages.length);
        
        let content = '';
        
        // Process all assistant messages
        for (const assistantMsg of assistantMessages) {
          console.log('Processing assistant message:', JSON.stringify(assistantMsg, null, 2));
          
          if (assistantMsg.message && assistantMsg.message.content) {
            let msgContent = '';
            if (Array.isArray(assistantMsg.message.content)) {
              msgContent = assistantMsg.message.content
                .map((c: any) => {
                  if (typeof c === 'string') return c;
                  if (c && typeof c === 'object' && c.text) return c.text;
                  return '[Object]'; // Placeholder for complex objects
                })
                .join('\n');
            } else {
              msgContent = assistantMsg.message.content.toString();
            }
            if (msgContent.trim()) {
              content += (content ? '\n\n' : '') + msgContent;
            }
          }
          
          // Also check if content is directly on the message object
          if (assistantMsg.content && typeof assistantMsg.content === 'string') {
            if (assistantMsg.content.trim()) {
              content += (content ? '\n\n' : '') + assistantMsg.content;
            }
          }
        }
        
        // Also process result messages (these often contain final summaries)
        const resultMessages = sdkMessages.filter((msg: any) => msg.type === 'result');
        for (const resultMsg of resultMessages) {
          console.log('Processing result message:', JSON.stringify(resultMsg, null, 2));
          if (resultMsg.result && typeof resultMsg.result === 'string') {
            if (resultMsg.result.trim()) {
              content += (content ? '\n\n--- Summary ---\n' : '') + resultMsg.result;
            }
          }
        }
        
        console.log('Final combined content extracted:', content);

        if (content) {
          // Check if this assistant response already exists
          const existingAssistantMessage = messages.find(msg => 
            msg.content === content && msg.role === 'assistant'
          );
          
          if (existingAssistantMessage) {
            console.log('Assistant message already exists, skipping add:', content.substring(0, 100) + '...');
          } else {
            const assistantMessage: AppPageMessage = {
              id: uuidv4(),
              app_id: appId,
              role: 'assistant',
              content,
              created_at: new Date().toISOString(),
              timestamp: new Date(),
            };

            // Save assistant message to database with raw Claude Code data
            await fetch(`/api/apps/${appId}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                role: 'assistant',
                content,
                raw_data: sdkMessages, // Save the entire raw SDK response
                message_type: 'claude_code_response'
              }),
            });

            setMessages(prev => [...prev, assistantMessage]);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: AppPageMessage = {
        id: uuidv4(),
        app_id: appId,
        role: 'assistant',
        content: 'Error: Failed to send message. Please try again.',
        created_at: new Date().toISOString(),
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

  const switchApp = (newAppId: string) => {
    router.push(`/app/${newAppId}`);
  };

  const openCodeViewer = () => {
    setShowCodeViewer(true);
  };

  const closeCodeViewer = () => {
    setShowCodeViewer(false);
  };

  const handleCreateApp = async () => {
    if (!createInput.trim()) return;

    try {
      const userId = AppManager.getUserId();
      
      // Create new app via API
      const response = await fetch('/api/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          name: createInput.trim().substring(0, 50), // Use first 50 chars as name
          description: createInput.trim()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newAppId = data.appId;
        
        // Close dialog and reset input
        setShowCreateDialog(false);
        setCreateInput('');
        
        // Navigate to new app with prompt
        router.push(`/app/${newAppId}?prompt=${encodeURIComponent(createInput.trim())}`);
      } else {
        console.error('Failed to create app');
      }
    } catch (error) {
      console.error('Error creating app:', error);
    }
  };

  const openSitePreview = async () => {
    if (currentApp) {
      try {
        const response = await fetch('/api/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appDirectory: currentApp.directory_path,
            action: 'start'
          }),
        });

        const data = await response.json();
        
        if (data.success && data.url) {
          // Open the preview in a new window
          window.open(data.url, '_blank');
        } else {
          alert('Failed to start preview server: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error starting preview:', error);
        alert('Failed to start preview server');
      }
    }
  };

  return (
    <div className="flex h-screen bg-background compact">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/')}
            >
              <Home className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold">Apps</h2>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>创建新应用</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Textarea
                      placeholder="描述你想要创建的应用..."
                      value={createInput}
                      onChange={(e) => setCreateInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleCreateApp();
                        }
                      }}
                      className="pr-14 min-h-[60px]"
                    />
                    <Button 
                      onClick={handleCreateApp}
                      size="sm"
                      className="absolute right-2 bottom-2 h-10 w-10 p-0"
                      disabled={!createInput.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-2">
              {apps.map((app) => (
                <Button
                  key={app.id}
                  variant={app.id === appId ? "default" : "ghost"}
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => switchApp(app.id)}
                >
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{app.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(app.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{currentApp?.name || 'App'}</h1>
              <p className="text-sm text-muted-foreground">
                {currentApp?.description}
                {appHasFiles && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    已创建
                  </span>
                )}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={openCodeViewer}>
                <Code className="h-4 w-4 mr-2" />
                View Code
              </Button>
              <Button variant="outline" onClick={openSitePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Preview Site
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-6 p-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  {isInitializing ? (
                    <div className="space-y-2">
                      <div className="text-lg">⏳</div>
                      <p className="text-lg font-medium text-foreground">正在加载应用...</p>
                      <p className="text-sm text-muted-foreground">
                        检查应用状态中
                      </p>
                    </div>
                  ) : appHasFiles ? (
                    <div className="space-y-3">
                      <div className="text-2xl">✅</div>
                      <p className="text-lg font-medium text-foreground">应用已创建完成！</p>
                      <p className="text-sm text-muted-foreground">
                        您可以继续与Claude对话来修改或添加功能
                      </p>
                      <div className="flex justify-center space-x-2 mt-4">
                        <Button variant="outline" size="sm" onClick={openCodeViewer}>
                          <Code className="h-4 w-4 mr-2" />
                          查看代码
                        </Button>
                        <Button variant="outline" size="sm" onClick={openSitePreview}>
                          <Eye className="h-4 w-4 mr-2" />
                          预览站点
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-foreground">开始创建您的应用</p>
                      <p className="text-sm text-muted-foreground">
                        Claude正在准备为您创建应用...
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <Card
                      className={`max-w-3xl ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <CardContent className="p-4">
                        <MessageContent 
                          content={message.content} 
                          role={message.role} 
                          raw_data={message.raw_data}
                          message_type={message.message_type}
                        />
                        <div className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <Card className="bg-muted">
                    <CardContent className="p-4">
                      <div className="animate-pulse">Claude is working on your app...</div>
                    </CardContent>
                  </Card>
                </div>
              )}
              </div>
            </ScrollArea>
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-4 flex-shrink-0">
            <div className="mx-auto">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="relative">
                <Textarea
                  placeholder="Describe what you want to add or modify..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="pr-14 min-h-[60px]"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  size="sm"
                  className="absolute right-2 bottom-2 h-10 w-10 p-0"
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Code Viewer */}
      {currentApp && (
        <CodeViewer
          isOpen={showCodeViewer}
          onClose={closeCodeViewer}
          appDirectory={currentApp.directory_path}
          appName={currentApp.name}
        />
      )}
    </div>
  );
}