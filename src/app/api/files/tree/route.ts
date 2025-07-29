import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

function buildFileTree(dirPath: string, basePath: string = dirPath): FileNode[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  try {
    const items = fs.readdirSync(dirPath);
    const nodes: FileNode[] = [];

    for (const item of items) {
      // Skip hidden files and node_modules
      if (item.startsWith('.') || item === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);
      const relativePath = path.relative(basePath, fullPath);

      const node: FileNode = {
        name: item,
        path: fullPath,
        isDirectory: stats.isDirectory(),
      };

      if (stats.isDirectory()) {
        node.children = buildFileTree(fullPath, basePath);
      }

      nodes.push(node);
    }

    // Sort: directories first, then files
    return nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error building file tree:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { directory } = await request.json();

    if (!directory) {
      return NextResponse.json(
        { error: 'Directory path is required' },
        { status: 400 }
      );
    }

    const tree = buildFileTree(directory);
    
    return NextResponse.json({ tree });
  } catch (error) {
    console.error('Error getting file tree:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}