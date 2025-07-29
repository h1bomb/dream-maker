import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const DREAM_MAKER_DIR = path.join(os.homedir(), '.dream-maker');
const DB_PATH = path.join(DREAM_MAKER_DIR, 'dream-maker.db');

export interface User {
  id: string;
  created_at: string;
}

export interface App {
  id: string;
  user_id: string;
  name: string;
  description: string;
  directory_path: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  app_id: string;
  role: 'user' | 'assistant';
  content: string;
  raw_data?: string;
  message_type?: string;
  created_at: string;
}

class ServerDatabase {
  private db: sqlite3.Database | null = null;

  async init(): Promise<void> {
    // Create .dream-maker directory if it doesn't exist
    if (!fs.existsSync(DREAM_MAKER_DIR)) {
      fs.mkdirSync(DREAM_MAKER_DIR, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        directory_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_id) REFERENCES apps(id)
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    // Run migrations to add new columns
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    try {
      // Check if raw_data column exists
      const tableInfo = await this.getTableInfo('messages');
      const hasRawData = tableInfo.some((col: any) => col.name === 'raw_data');
      const hasMessageType = tableInfo.some((col: any) => col.name === 'message_type');

      if (!hasRawData) {
        console.log('Adding raw_data column to messages table');
        await this.run('ALTER TABLE messages ADD COLUMN raw_data TEXT');
      }

      if (!hasMessageType) {
        console.log('Adding message_type column to messages table');
        await this.run('ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT "text"');
      }
    } catch (error) {
      console.error('Migration error:', error);
      // Don't throw - let the app continue to work
    }
  }

  private getTableInfo(tableName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  private all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  // User methods
  async createUser(id: string): Promise<void> {
    await this.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [id]);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.get<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  // App methods
  async createApp(app: Omit<App, 'created_at' | 'updated_at'>): Promise<void> {
    await this.run(
      'INSERT INTO apps (id, user_id, name, description, directory_path) VALUES (?, ?, ?, ?, ?)',
      [app.id, app.user_id, app.name, app.description, app.directory_path]
    );
  }

  async getApp(id: string): Promise<App | undefined> {
    return this.get<App>('SELECT * FROM apps WHERE id = ?', [id]);
  }

  async getUserApps(userId: string): Promise<App[]> {
    return this.all<App>('SELECT * FROM apps WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  }

  async updateAppUpdatedAt(id: string): Promise<void> {
    await this.run('UPDATE apps SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }

  // Message methods
  async createMessage(message: Omit<Message, 'created_at'>): Promise<void> {
    await this.run(
      'INSERT INTO messages (id, app_id, role, content, raw_data, message_type) VALUES (?, ?, ?, ?, ?, ?)',
      [message.id, message.app_id, message.role, message.content, message.raw_data || null, message.message_type || 'text']
    );
  }

  async getAppMessages(appId: string): Promise<Message[]> {
    return this.all<Message>('SELECT * FROM messages WHERE app_id = ? ORDER BY created_at ASC', [appId]);
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
const serverDatabase = new ServerDatabase();

export class ServerAppManager {
  static async createAppDirectory(appId: string): Promise<string> {
    const appDir = path.join(DREAM_MAKER_DIR, appId);
    
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }
    
    return appDir;
  }

  static async createApp(userId: string, name: string, description: string): Promise<{ id: string; directory: string }> {
    const appId = uuidv4();
    const directory = await this.createAppDirectory(appId);
    
    await serverDatabase.createApp({
      id: appId,
      user_id: userId,
      name,
      description,
      directory_path: directory
    });

    return { id: appId, directory };
  }
}

export { serverDatabase, DREAM_MAKER_DIR };