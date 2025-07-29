import { NextRequest, NextResponse } from 'next/server';
import { serverDatabase } from '@/lib/server-database';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appId } = await params;
    await serverDatabase.init();
    
    // Get app to find its directory
    const app = await serverDatabase.getApp(appId);
    if (!app) {
      return NextResponse.json(
        { error: 'App not found' },
        { status: 404 }
      );
    }

    // Check if directory exists and has files
    const appDirectory = app.directory_path;
    let hasFiles = false;
    let fileCount = 0;

    if (fs.existsSync(appDirectory)) {
      try {
        const files = fs.readdirSync(appDirectory);
        // Filter out hidden files and only count actual files (not directories)
        const actualFiles = files.filter(file => {
          if (file.startsWith('.')) return false;
          const filePath = path.join(appDirectory, file);
          return fs.statSync(filePath).isFile();
        });
        
        fileCount = actualFiles.length;
        hasFiles = fileCount > 0;
      } catch (error) {
        console.error('Error reading app directory:', error);
      }
    }

    return NextResponse.json({ 
      hasFiles,
      fileCount,
      directory: appDirectory
    });
  } catch (error) {
    console.error('Error checking app files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}