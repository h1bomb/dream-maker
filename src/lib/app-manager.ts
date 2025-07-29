import { v4 as uuidv4 } from 'uuid';

export class AppManager {
  static getUserId(): string {
    if (typeof window === 'undefined') {
      throw new Error('getUserId can only be called on the client side');
    }

    let userId = localStorage.getItem('dream-maker-user-id');
    
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('dream-maker-user-id', userId);
    }

    return userId;
  }

  static async initializeUser(): Promise<string> {
    const userId = this.getUserId();
    
    // Send to server to create user in database
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error('Error creating user:', error);
    }
    
    return userId;
  }
}