import { NextRequest, NextResponse } from 'next/server';
import { serverDatabase, ServerAppManager } from '@/lib/server-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    await serverDatabase.init();
    const apps = await serverDatabase.getUserApps(userId);
    return NextResponse.json({ apps });
  } catch (error) {
    console.error('Error fetching apps:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, name, description } = await request.json();

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'User ID and name are required' },
        { status: 400 }
      );
    }

    await serverDatabase.init();
    const { id: appId, directory } = await ServerAppManager.createApp(userId, name, description || '');
    
    return NextResponse.json({ 
      appId, 
      directory,
      success: true 
    });
  } catch (error) {
    console.error('Error creating app:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}