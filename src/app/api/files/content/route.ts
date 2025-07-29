import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      return NextResponse.json(
        { error: 'Path is a directory, not a file' },
        { status: 400 }
      );
    }

    // Check file size (limit to 1MB for safety)
    if (stats.size > 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large to display (max 1MB)' },
        { status: 400 }
      );
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return NextResponse.json({ content });
    } catch (readError) {
      // If UTF-8 reading fails, it might be a binary file
      return NextResponse.json(
        { error: 'Cannot display binary file content' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}