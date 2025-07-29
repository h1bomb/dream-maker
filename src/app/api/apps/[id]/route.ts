import { NextRequest, NextResponse } from 'next/server';
import { serverDatabase } from '@/lib/server-database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appId } = await params;
    await serverDatabase.init();
    const app = await serverDatabase.getApp(appId);
    
    if (!app) {
      return NextResponse.json(
        { error: 'App not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ app });
  } catch (error) {
    console.error('Error fetching app:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}