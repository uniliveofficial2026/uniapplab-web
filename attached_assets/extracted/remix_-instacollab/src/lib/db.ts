import { USERS, POSTS } from './data';

type Listener = () => void;

class LocalDB {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<Listener> = new Set();
  private cache: Record<string, any> = {};
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  
  constructor() {
    // 1. Pre-populate cache synchronously from localStorage for instant, zero-delay load
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            if (value && value !== 'undefined') {
              try {
                this.cache[key] = JSON.parse(value);
              } catch (e) {
                this.cache[key] = value;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage prepopulate failed:', e);
    }

    // 2. Initialize IDB in background & notify listeners
    this.initIDB().then(() => {
      this.isInitialized = true;
      this.notifyListeners();
    });

    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        this.channel = new BroadcastChannel('app-sync');
        this.channel.onmessage = (event) => {
          if (event.data === 'sync') {
            this.refreshFromDB().then(() => this.notifyListeners());
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not available:', e);
    }
  }

  private async initIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AppDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.refreshFromDB().then(() => resolve(request.result));
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        db.createObjectStore('collections');
      };
    });
  }

  private async refreshFromDB() {
    if (!this.db) return;
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(['collections'], 'readonly');
      const store = transaction.objectStore('collections');
      const request = store.getAll();
      const keysRequest = store.getAllKeys();

      request.onsuccess = () => {
        const values = request.result;
        keysRequest.onsuccess = () => {
          const keys = keysRequest.result as string[];
          keys.forEach((key, i) => {
            this.cache[key] = values[i];
          });
          resolve();
        };
      };
      request.onerror = () => reject(request.error);
    });
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private get MAX_ITEMS() {
    try {
      const user = this.currentUser;
      const tier = user?.storageTier || '50GB';
      if (tier === 'Unlimited') return 1000000;
      if (tier === '100GB') return 100000;
      return 5000;
    } catch (e) {
      return 1000;
    }
  }

  private get MAX_SIZE() {
    try {
      const user = this.currentUser;
      const tier = user?.storageTier || '50GB';
      // Simulated limits for the UI and cleanup logic
      if (tier === 'Unlimited') return 100 * 1024 * 1024 * 1024; // 100GB simulated max
      if (tier === '100GB') return 100 * 1024 * 1024 * 1024;
      return 50 * 1024 * 1024 * 1024;
    } catch (e) {
      return 50 * 1024 * 1024;
    }
  }

  private getPartitionedKey(key: string): string {
    const globalKeys = ['currentUserId', 'isLoggedIn', 'user_accounts', 'local_active_uid', 'users'];
    if (globalKeys.includes(key)) {
      return key;
    }
    let currentUid = '';
    try {
      if (this.cache['currentUserId'] !== undefined) {
        currentUid = this.cache['currentUserId'];
      } else {
        const saved = localStorage.getItem('currentUserId');
        if (saved && saved !== 'undefined') {
          currentUid = JSON.parse(saved);
        }
      }
    } catch (e) {}

    if (!currentUid) {
      currentUid = 'u1';
    }
    return `${currentUid}_${key}`;
  }

  private async performStorageCleanup() {
    if (!this.db) return;
    return new Promise<void>((resolve) => {
      const transaction = this.db!.transaction(['collections'], 'readwrite');
      const store = transaction.objectStore('collections');
      const request = store.getAllKeys();
      
      request.onsuccess = async () => {
        const keys = request.result as string[];
        const keep = ['posts', 'users', 'isLoggedIn', 'currentUserId', 'app_settings', 'reels'];
        const purgeable = keys.filter(k => {
          if (keep.includes(k)) return false;
          if (keep.some(essential => k.endsWith('_' + essential))) return false;
          return true;
        });
        
        // Remove oldest 30% of purgeable data
        const toDeleteCount = Math.ceil(purgeable.length * 0.3);
        for (let i = 0; i < toDeleteCount; i++) {
          store.delete(purgeable[i]);
          delete this.cache[purgeable[i]];
        }
        resolve();
      };
      request.onerror = () => resolve();
    });
  }

  private async saveToIDB(key: string, data: any) {
    const partitionedKey = this.getPartitionedKey(key);
    if (!this.db) {
       this.cache[partitionedKey] = data;
       return;
    }
    
    const stats = this.getStorageStats();
    if (stats.rawSize > this.MAX_SIZE || stats.items > this.MAX_ITEMS) {
      const tier = this.currentUser?.storageTier || '50GB';
      if (tier !== 'Unlimited') {
        await this.performStorageCleanup();
      }
    }

    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['collections'], 'readwrite');
        const store = transaction.objectStore('collections');
        const request = store.put(data, partitionedKey);
        
        request.onsuccess = () => {
          this.cache[partitionedKey] = data;
          this.notifyListeners();
          this.channel?.postMessage('sync');
          resolve();
        };
        request.onerror = () => {
          // Tiered recovery if quota exceeded
          if (request.error?.name === 'QuotaExceededError') {
             this.performStorageCleanup().then(() => resolve());
          } else {
             reject(request.error);
          }
        };
      } catch (e) {
        console.warn('IDB Transaction Error:', e);
        this.cache[partitionedKey] = data;
        resolve();
      }
    });
  }

  save(key: string, data: any) {
    const partitionedKey = this.getPartitionedKey(key);
    // Synchronous update of cache for immediate UI response
    this.cache[partitionedKey] = data;
    this.notifyListeners();
    this.channel?.postMessage('sync');
    
    // Background persistence to IndexedDB
    this.saveToIDB(key, data).catch(err => {
      console.error(`IDB Save Error for ${key}:`, err);
    });

    // Mirror all keys to localStorage for instant, synchronous loading
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(partitionedKey, JSON.stringify(data));
      }
    } catch (e) {
      console.warn(`LocalStorage mirror failed for ${key} (quota exceeded?):`, e);
    }
  }

  public load(key: string, defaultData: any) {
    const partitionedKey = this.getPartitionedKey(key);
    if (this.cache[partitionedKey] !== undefined && this.cache[partitionedKey] !== null) return this.cache[partitionedKey];
    
    // Fallback to localStorage for initial load or essential keys
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(partitionedKey);
        if (saved && saved !== 'undefined') {
          const parsed = JSON.parse(saved);
          this.cache[partitionedKey] = parsed; // Cache it for future synchronous lookups
          return parsed;
        }
      }
    } catch (e) {}
    
    return defaultData;
  }

  // Getters & Methods
  get posts() { return this.load('posts', POSTS) || POSTS; }
  get users() { return this.load('users', USERS) || USERS; }
  get isLoggedIn() { return this.load('isLoggedIn', true); }
  get currentUserId() { return this.load('currentUserId', 'u1'); }
  get currentUser() {
    try {
      const users = this.users || [];
      const id = this.currentUserId;
      if (!Array.isArray(users) || users.length === 0) return USERS[0];
      return users.find((u: any) => u && u.id === id) || users[0] || USERS[0];
    } catch (e) {
      return USERS[0];
    }
  }

  login(userId: string) {
    this.save('currentUserId', userId);
    this.save('isLoggedIn', true);
  }

  logout() {
    this.save('isLoggedIn', false);
  }

  registerUser(user: any) {
    const added = [...this.users, user];
    this.save('users', added);
    this.login(user.id);
  }

  addPost(post: any) {
    const newPost = {
      ...post,
      id: post.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    this.save('posts', [newPost, ...this.posts]);
  }

  updatePost(id: string, updateFn: (post: any) => any) {
    const updated = this.posts.map((p: any) => p.id === id ? updateFn(p) : p);
    this.save('posts', updated);
  }

  deletePost(id: string) {
    const updated = this.posts.filter((p: any) => p.id !== id);
    this.save('posts', updated);
  }

  updateUser(id: string, updateFn: (user: any) => any) {
    let found = false;
    const updated = this.users.map((u: any) => {
      if (u && u.id === id) {
        found = true;
        return updateFn(u);
      }
      return u;
    });
    if (!found) {
      updated.push(updateFn({ id }));
    }
    this.save('users', updated);
  }

  // Workspace
  get tasks() {
    return this.load('workspace_tasks', [
      { id: 101, title: 'Update Marketing Assets', team: 'Design', due: 'Today', user: 1, completed: false },
      { id: 102, title: 'Setup Secure Payment Gateway', team: 'Engineering', due: 'Tomorrow', user: 3, completed: false },
      { id: 103, title: 'Weekly Analytics Review', team: 'Management', due: 'In 2 days', user: 0, completed: true },
    ]) || [];
  }
  
  addTask(task: any) {
    const newTask = {
      ...task,
      id: task.id || Date.now()
    };
    this.save('workspace_tasks', [newTask, ...this.tasks]);
  }
  
  updateTask(id: number, updateFn: (task: any) => any) {
    const updated = this.tasks.map((t: any) => t.id === id ? updateFn(t) : t);
    this.save('workspace_tasks', updated);
  }
  
  deleteTask(id: number) {
    this.save('workspace_tasks', this.tasks.filter((t: any) => t.id !== id));
  }
  
  get auditLogs() {
    return this.load('workspace_auditLogs', [
      { id: 1, text: 'Sarah updated "Stripe Integration"', time: 'Just now' },
      { id: 2, text: 'Backup completed.', time: '1h ago' },
    ]) || [];
  }
  
  addAuditLog(log: any) {
    this.save('workspace_auditLogs', [log, ...this.auditLogs]);
  }

  get reels() {
    const defaultReels = [
      { id: '1', user: this.users[1], likes: 12400, comments: 452, caption: '🎬 #reels', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
      { id: '2', user: this.users[2], likes: 8900, comments: 210, caption: '🔥 #editing', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
    ];
    return this.load('reels', defaultReels) || defaultReels;
  }

  addReel(reel: any) {
    const newReel = {
      ...reel,
      id: reel.id || `r_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    this.save('reels', [newReel, ...this.reels]);
  }

  updateReel(id: string, updateFn: (reel: any) => any) {
    const updated = this.reels.map((r: any) => r.id === id ? updateFn(r) : r);
    this.save('reels', updated);
  }

  deleteReel(id: string) {
    const updated = this.reels.filter((r: any) => r.id !== id);
    this.save('reels', updated);
  }

  get notifications() {
    const defaultData = [
      { id: '1', type: 'system', title: 'Welcome to Venture Finance', text: 'Thanks for joining!', time: '1 day ago' },
      { id: '2', type: 'mention', text: '@you check out this new feature.', time: '2 hrs ago', user: this.users[1] },
      { id: '3', type: 'like', time: '5 hrs ago', user: this.users[2] },
      { id: '4', type: 'follow', time: '1 day ago', user: this.users[3] },
    ];
    return this.load('notifications', defaultData) || defaultData;
  }

  clearNotifications() {
    this.setHasUnreadNotifications(false);
    this.save('notifications', []);
  }

  addNotification(notification: any) {
    this.setHasUnreadNotifications(true);
    this.save('notifications', [{
      ...notification,
      id: Math.random().toString(36).substring(2, 9),
      time: 'Just now'
    }, ...this.notifications]);
  }
  
  get files() {
    const defaultFiles = [
      { id: '1', name: 'App_Architecture.pdf', date: '2 hrs ago', size: '2.4 MB', author: 1 },
      { id: '2', name: 'Financials.xlsx', date: 'Yesterday', size: '1.1 MB', author: 0 },
    ];
    return this.load('workspace_files', defaultFiles) || defaultFiles;
  }

  addFile(file: any) {
    this.save('workspace_files', [file, ...this.files]);
  }

  deleteFile(id: string) {
    this.save('workspace_files', this.files.filter((f: any) => f.id !== id));
  }

  get messages() {
    return this.load('messages', {}) || {};
  }

  addMessage(chatId: string, message: any) {
    const msgs = this.messages;
    const existing = msgs[chatId] || [];
    this.setUnreadMessagesCount(this.unreadMessagesCount + 1);
    this.save('messages', {
      ...msgs,
      [chatId]: [...existing, message]
    });
  }

  get stories() { return this.load('stories', {}) || {}; }
  addStorySegment(userId: string, segment: any) {
    const all = this.stories;
    const userSegs = all[userId] || [];
    this.save('stories', { ...all, [userId]: [segment, ...userSegs] });
  }

  get settings() {
    const defaults = {
      notificationsEnabled: true,
      theme: 'dark',
      isPrivate: false,
      language: 'en'
    };
    const loaded = this.load('app_settings', defaults) || defaults;
    if (loaded.language === 'English') loaded.language = 'en';
    return loaded;
  }

  updateSettings(update: any) {
    this.save('app_settings', { ...this.settings, ...update });
  }

  get globalMuted() { return this.load('globalMuted', true); }
  setGlobalMuted(muted: boolean) { this.save('globalMuted', muted); }

  get isFullScreenActive() { return this.load('isFullScreenActive', false); }
  setFullScreenActive(active: boolean) { this.save('isFullScreenActive', active); }

  get unreadMessagesCount() { return this.load('unreadMessagesCount', 3); }
  setUnreadMessagesCount(count: number) { this.save('unreadMessagesCount', count); }

  get hasUnreadNotifications() { return this.load('hasUnreadNotifications', true); }
  setHasUnreadNotifications(has: boolean) { this.save('hasUnreadNotifications', has); }

  get reelComments() {
    return this.load('reel_comments', {}) || {};
  }

  addReelComment(reelId: string, comment: any) {
    const rComments = this.reelComments || {};
    const existing = rComments[reelId] || [];
    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      replies: [],
      timestamp: Date.now(),
      ...comment
    };
    this.save('reel_comments', {
      ...rComments,
      [reelId]: [newComment, ...existing]
    });
  }

  get postComments() {
    return this.load('post_comments', {}) || {};
  }

  addPostComment(postId: string, comment: any) {
    const pComments = this.postComments || {};
    const existing = pComments[postId] || [];
    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      replies: [],
      timestamp: Date.now(),
      ...comment
    };
    this.save('post_comments', {
      ...pComments,
      [postId]: [newComment, ...existing]
    });
  }

  likePostComment(postId: string, commentId: string, userId: string) {
    const pComments = this.postComments;
    const existing = pComments[postId] || [];
    
    const toggleLike = (comments: any[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.likedBy = comment.likedBy || [];
          if (comment.likedBy.includes(userId)) {
             comment.likedBy = comment.likedBy.filter((u: string) => u !== userId);
             comment.likes = Math.max(0, (comment.likes || 0) - 1);
          } else {
             comment.likedBy.push(userId);
             comment.likes = (comment.likes || 0) + 1;
          }
          return true;
        }
        if (comment.replies && comment.replies.length > 0) {
          if (toggleLike(comment.replies)) return true;
        }
      }
      return false;
    };
    
    toggleLike(existing);
    this.save('post_comments', { ...pComments, [postId]: existing });
  }

  addPostCommentReply(postId: string, commentId: string, reply: any) {
    const pComments = this.postComments;
    const existing = pComments[postId] || [];
    const newReply = {
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      replies: [],
      timestamp: Date.now(),
      ...reply
    };
    
    const addReply = (comments: any[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.replies = comment.replies || [];
          comment.replies.push(newReply);
          return true;
        }
        if (comment.replies && comment.replies.length > 0) {
          if (addReply(comment.replies)) return true;
        }
      }
      return false;
    };
    
    addReply(existing);
    this.save('post_comments', { ...pComments, [postId]: existing });
  }

  getUserStorySegments(userId: string) {
    const allStories = this.stories;
    return allStories[userId] || [];
  }

  public clearCache() {
    this.cache = {};
    localStorage.clear();
    if (this.db) {
       const transaction = this.db.transaction(['collections'], 'readwrite');
       transaction.objectStore('collections').clear();
    }
    this.notifyListeners();
  }

  public getStorageStats() {
    let total = 0;
    // Rough estimation from cache
    for (const key in this.cache) {
      try {
        const val = JSON.stringify(this.cache[key]);
        total += (val.length + key.length) * 2;
      } catch (e) {}
    }
    
    // Add localStorage too
    for(let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        if(k) total += (localStorage.getItem(k)?.length || 0) * 2;
    }

    return {
      rawSize: total,
      size: this.formatBytes(total),
      items: Object.keys(this.cache).length + localStorage.length
    };
  }

  private formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

export const db = new LocalDB();
