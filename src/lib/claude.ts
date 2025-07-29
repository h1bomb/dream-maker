import { query, type SDKMessage } from "@anthropic-ai/claude-code";

export interface ClaudeOptions {
  maxTurns?: number;
  cwd?: string;
  continue?: boolean;
}

export class ClaudeClient {
  async createMessage(prompt: string, options: ClaudeOptions = {}) {
    try {
      const messages: SDKMessage[] = [];
      const abortController = new AbortController();

      const queryOptions: any = {
        maxTurns: options.maxTurns || 100,
        permissionMode: 'bypassPermissions',
      };

      if (options.cwd) {
        queryOptions.cwd = options.cwd;
        // Ensure the directory exists and has proper permissions
        console.log('Setting working directory to:', options.cwd);
        // Add explicit instructions for file creation
        prompt = `请在工作目录 ${options.cwd} 中工作。确保所有文件都创建在这个目录中。\n\n${prompt}`;
      }

      if (options.continue !== undefined) {
        queryOptions.continue = options.continue;
      }

      console.log('Claude SDK query with options:', { prompt: prompt.substring(0, 100) + '...', queryOptions });

      for await (const message of query({
        prompt,
        abortController,
        options: queryOptions,
      })) {
        console.log('Received message from Claude SDK:', message.type, message);
        messages.push(message);
      }

      return { messages, success: true };
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async streamMessage(prompt: string, onChunk?: (message: SDKMessage) => void, options: ClaudeOptions = {}) {
    try {
      const messages: SDKMessage[] = [];
      const abortController = new AbortController();

      const queryOptions: any = {
        maxTurns: options.maxTurns || 100,
        permissionMode: 'bypassPermissions',
      };

      if (options.cwd) {
        queryOptions.cwd = options.cwd;
      }

      if (options.continue !== undefined) {
        queryOptions.continue = options.continue;
      }

      for await (const message of query({
        prompt,
        abortController,
        options: queryOptions,
      })) {
        messages.push(message);
        if (onChunk) {
          onChunk(message);
        }
      }

      return { messages, success: true };
    } catch (error) {
      console.error('Error streaming message:', error);
      throw error;
    }
  }
}