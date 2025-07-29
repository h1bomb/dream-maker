import { NextRequest, NextResponse } from 'next/server';
import { ClaudeClient, ClaudeOptions } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const { message, appId, cwd, continue: continueConversation } = await request.json();
    console.log('Chat API received:', { message, appId, cwd, continue: continueConversation });

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const options: ClaudeOptions = {
      maxTurns: 100,
      continue: continueConversation || true
    };

    if (cwd) {
      options.cwd = cwd;
    }

    const claude = new ClaudeClient();
    const response = await claude.createMessage(message, options);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}