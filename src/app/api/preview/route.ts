import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const runningServers = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const { appDirectory, action } = await request.json();

    if (!appDirectory) {
      return NextResponse.json(
        { error: 'App directory is required' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      return startDevServer(appDirectory);
    } else if (action === 'stop') {
      return stopDevServer(appDirectory);
    } else if (action === 'status') {
      return getServerStatus(appDirectory);
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in preview API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function startDevServer(appDirectory: string) {
  try {
    if (!fs.existsSync(appDirectory)) {
      return NextResponse.json(
        { error: 'App directory not found' },
        { status: 404 }
      );
    }

    // Check if server is already running
    if (runningServers.has(appDirectory)) {
      return NextResponse.json({
        success: true,
        port: runningServers.get(appDirectory).port,
        url: `http://localhost:${runningServers.get(appDirectory).port}`,
        message: 'Server already running'
      });
    }

    // Find an available port (starting from 3001)
    const port = await findAvailablePort(3001);

    // Check if package.json exists
    const packageJsonPath = path.join(appDirectory, 'package.json');
    let command = 'npm';
    let args = ['run', 'dev'];

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts && packageJson.scripts.dev) {
          // Use npm run dev if available
          command = 'npm';
          args = ['run', 'dev'];
        } else if (packageJson.scripts && packageJson.scripts.start) {
          // Fallback to npm start
          command = 'npm';
          args = ['start'];
        }
      } catch (error) {
        console.error('Error reading package.json:', error);
      }
    } else {
      // If no package.json, try to serve with a simple HTTP server
      command = 'npx';
      args = ['serve', '-s', '.', '-p', port.toString()];
    }

    // Set environment variable for port
    const env = { ...process.env, PORT: port.toString() };

    const child = spawn(command, args, {
      cwd: appDirectory,
      env,
      detached: false,
      stdio: 'pipe'
    });

    runningServers.set(appDirectory, { process: child, port });

    // Handle process events
    child.on('error', (error) => {
      console.error('Dev server error:', error);
      runningServers.delete(appDirectory);
    });

    child.on('exit', (code) => {
      console.log(`Dev server exited with code ${code}`);
      runningServers.delete(appDirectory);
    });

    // Give the server a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    return NextResponse.json({
      success: true,
      port,
      url: `http://localhost:${port}`,
      message: 'Development server started'
    });

  } catch (error) {
    console.error('Error starting dev server:', error);
    return NextResponse.json(
      { error: 'Failed to start development server' },
      { status: 500 }
    );
  }
}

async function stopDevServer(appDirectory: string) {
  try {
    const serverInfo = runningServers.get(appDirectory);
    
    if (!serverInfo) {
      return NextResponse.json({
        success: true,
        message: 'No server running for this app'
      });
    }

    // Kill the process
    serverInfo.process.kill('SIGTERM');
    runningServers.delete(appDirectory);

    return NextResponse.json({
      success: true,
      message: 'Development server stopped'
    });

  } catch (error) {
    console.error('Error stopping dev server:', error);
    return NextResponse.json(
      { error: 'Failed to stop development server' },
      { status: 500 }
    );
  }
}

async function getServerStatus(appDirectory: string) {
  const serverInfo = runningServers.get(appDirectory);
  
  if (serverInfo) {
    return NextResponse.json({
      running: true,
      port: serverInfo.port,
      url: `http://localhost:${serverInfo.port}`
    });
  } else {
    return NextResponse.json({
      running: false
    });
  }
}

async function findAvailablePort(startPort: number): Promise<number> {
  const net = require('net');
  
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address()?.port;
      server.close(() => {
        resolve(port);
      });
    });
    
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}