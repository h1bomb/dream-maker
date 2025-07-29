import { NextRequest, NextResponse } from 'next/server';
import { serverDatabase } from '@/lib/server-database';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appId } = await params;
    await serverDatabase.init();
    const messages = await serverDatabase.getAppMessages(appId);
    
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appId } = await params;
    const { role, content, raw_data, message_type } = await request.json();

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    await serverDatabase.init();
    
    // Check if message with same content and role already exists
    const existingMessages = await serverDatabase.getAppMessages(appId);
    const isDuplicate = existingMessages.some(msg => 
      msg.content === content && msg.role === role
    );
    
    if (isDuplicate) {
      console.log('Duplicate message detected, skipping save:', { role, content: content.substring(0, 100) + '...' });
      return NextResponse.json({ 
        messageId: null,
        success: true,
        duplicate: true
      });
    }

    const messageId = uuidv4();
    await serverDatabase.createMessage({
      id: messageId,
      app_id: appId,
      role,
      content,
      raw_data: raw_data ? JSON.stringify(raw_data) : undefined,
      message_type: message_type || 'text'
    });

    // Update app's updated_at timestamp
    await serverDatabase.updateAppUpdatedAt(appId);

    return NextResponse.json({ 
      messageId,
      success: true,
      duplicate: false
    });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}