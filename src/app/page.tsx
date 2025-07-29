'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppManager } from '@/lib/app-manager';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Initialize database and user on component mount
    const initialize = async () => {
      try {
        await fetch('/api/init', { method: 'POST' });
        await AppManager.initializeUser();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    
    initialize();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const userId = AppManager.getUserId();
      
      // Create new app
      const response = await fetch('/api/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          name: prompt.slice(0, 50), // Use first 50 chars as name
          description: prompt
        }),
      });

      const data = await response.json();
      
      if (data.appId) {
        // Navigate to app creation page
        router.push(`/app/${data.appId}?prompt=${encodeURIComponent(prompt)}`);
      }
    } catch (error) {
      console.error('Error creating app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8 compact">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Dream Maker</h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI Agent Platform powered by Claude Code SDK
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="relative">
          <Input
            type="text"
            placeholder="What would you like to build today?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="text-lg p-4 h-14 pr-14"
            autoFocus
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="sm"
            className="absolute right-2 top-2 h-10 w-10 p-0"
            disabled={!prompt.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}