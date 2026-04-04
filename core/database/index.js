import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import Users from './models/users.js';
import Threads from './models/threads.js';
import Currencies from './models/currencies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  constructor() {
    const dbPath = join(__dirname, '..', '..', 'storage', 'data', 'database.sqlite');
    const dbDir = dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(dbPath);
    this.users = null;
    this.threads = null;
    this.currencies = null;
  }
  
  async init() {
    try {
      this.users = new Users(this.db);
      this.threads = new Threads(this.db);
      this.currencies = new Currencies(this.db);
      
      await this.users.initTable();
      await this.threads.initTable();
      await this.currencies.initTable();
      await this.loadAllData();
      
      return true;
    } catch (error) {
      global.logger.error('Lỗi khi khởi tạo database:', error);
      throw error;
    }
  }
  
  async loadAllData() {
    try {
      const users = await this.users.getAll();
      users.forEach(user => {
        global.data.userData.set(user.userID, user);
      });
      
      const threads = await this.threads.getAll();
      threads.forEach(thread => {
        global.data.threadData.set(thread.threadID, thread);
        if (thread.participantIDs) {
          global.data.allThreadID.set(thread.threadID, thread.participantIDs);
        }
      });
      
      const currencies = await this.currencies.getAll();
      currencies.forEach(currency => {
        global.data.currencyData.set(currency.userID, currency);
      });
    } catch (error) {
      global.logger.error('Lỗi khi tải database:', error);
    }
  }
  
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export default Database;