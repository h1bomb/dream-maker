import { NextResponse } from 'next/server';
import { serverDatabase } from '@/lib/server-database';

export async function POST() {
  try {
    await serverDatabase.init();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database' },
      { status: 500 }
    );
  }
}