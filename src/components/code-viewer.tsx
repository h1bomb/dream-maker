'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { File, Folder, FolderOpen, X } from 'lucide-react';
import path from 'path';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface CodeViewerProps {
  isOpen: boolean;
  onClose: () => void;
  appDirectory: string;
  appName: string;
}

export function CodeViewer({ isOpen, onClose, appDirectory, appName }: CodeViewerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && appDirectory) {
      loadFileTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, appDirectory]);

  const loadFileTree = async () => {
    try {
      const response = await fetch('/api/files/tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory: appDirectory }),
      });
      const data = await response.json();
      if (data.tree) {
        setFileTree(data.tree);
      }
    } catch (error) {
      console.error('Error loading file tree:', error);
    }
  };

  const loadFileContent = async (filePath: string) => {
    try {
      const response = await fetch('/api/files/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath }),
      });
      const data = await response.json();
      if (data.content !== undefined) {
        setFileContent(data.content);
        setSelectedFile(filePath);
      }
    } catch (error) {
      console.error('Error loading file content:', error);
    }
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center space-x-2 px-2 py-1 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
            selectedFile === node.path ? 'bg-accent text-accent-foreground' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleFolder(node.path);
            } else {
              loadFileContent(node.path);
            }
          }}
        >
          {node.isDirectory ? (
            expandedFolders.has(node.path) ? (
              <FolderOpen className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )
          ) : (
            <File className="h-4 w-4" />
          )}
          <span className="text-sm">{node.name}</span>
        </div>
        {node.isDirectory && expandedFolders.has(node.path) && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const getLanguageFromExtension = (ext: string) => {
    const langMap: { [key: string]: string } = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      css: 'css',
      html: 'html',
      json: 'json',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
    };
    return langMap[ext] || 'text';
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[90vw] h-full p-0">
        <div className="flex h-full">
          {/* File Tree Sidebar */}
          <div className="w-80 border-r border-border bg-card">
            <SheetHeader className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle>Code Viewer</SheetTitle>
                  <SheetDescription>{appName}</SheetDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="py-2">
                {fileTree.length > 0 ? (
                  renderFileTree(fileTree)
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No files found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Code Content */}
          <div className="flex-1 flex flex-col">
            {selectedFile ? (
              <>
                <div className="p-4 border-b border-border bg-muted/50">
                  <h3 className="text-sm font-medium">{path.basename(selectedFile)}</h3>
                  <p className="text-xs text-muted-foreground">{selectedFile}</p>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="p-4 text-sm font-mono overflow-x-auto">
                    <code className={`language-${getLanguageFromExtension(getFileExtension(selectedFile))}`}>
                      {fileContent}
                    </code>
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a file from the tree to view its contents
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}