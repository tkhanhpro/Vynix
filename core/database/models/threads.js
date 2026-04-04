class Threads {
  constructor(db) {
    this.db = db;
  }

  parseJSON(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
  }

  async initTable() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS threads (
        threadID TEXT PRIMARY KEY,
        threadName TEXT,
        participantIDs TEXT,
        unreadCount INTEGER,
        messageCount INTEGER,
        emoji TEXT,
        color TEXT,
        threadTheme TEXT,
        nicknames TEXT,
        adminIDs TEXT,
        approvalMode INTEGER,
        approvalQueue TEXT,
        imageSrc TEXT,
        threadType INTEGER,
        extra TEXT
      )
    `);

    const columns = await this.all(`PRAGMA table_info(threads)`);
    const columnNames = new Set(columns.map(column => column.name));

    const requiredColumns = [
      ['emoji', 'TEXT'],
      ['color', 'TEXT'],
      ['threadTheme', 'TEXT'],
      ['nicknames', 'TEXT'],
      ['approvalMode', 'INTEGER'],
      ['approvalQueue', 'TEXT'],
      ['imageSrc', 'TEXT'],
      ['threadType', 'INTEGER'],
      ['extra', 'TEXT']
    ];

    for (const [name, type] of requiredColumns) {
      if (!columnNames.has(name)) {
        await this.run(`ALTER TABLE threads ADD COLUMN ${name} ${type}`);
      }
    }
  }

  async get(threadID) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM threads WHERE threadID = ?', [threadID], (error, row) => {
        if (error) {
          reject(error);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          threadName: row.threadName,
          participantIDs: this.parseJSON(row.participantIDs, []),
          unreadCount: Number(row.unreadCount ?? 0),
          messageCount: Number(row.messageCount ?? 0),
          emoji: row.emoji,
          color: row.color,
          threadTheme: row.threadTheme,
          nicknames: this.parseJSON(row.nicknames, {}),
          adminIDs: this.parseJSON(row.adminIDs, []),
          approvalMode: Boolean(row.approvalMode),
          approvalQueue: this.parseJSON(row.approvalQueue, []),
          imageSrc: row.imageSrc,
          threadType: row.threadType,
          extra: this.parseJSON(row.extra, {})
        });
      });
    });
  }

  async set(threadID, data) {
    return new Promise((resolve, reject) => {
      const {
        threadName,
        participantIDs,
        unreadCount,
        messageCount,
        emoji,
        color,
        threadTheme,
        nicknames,
        adminIDs,
        approvalMode,
        approvalQueue,
        imageSrc,
        threadType,
        extra
      } = data;

      this.db.run(`
        INSERT OR REPLACE INTO threads (
          threadID,
          threadName,
          participantIDs,
          unreadCount,
          messageCount,
          emoji,
          color,
          threadTheme,
          nicknames,
          adminIDs,
          approvalMode,
          approvalQueue,
          imageSrc,
          threadType,
          extra
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        threadID,
        threadName ?? null,
        JSON.stringify(Array.isArray(participantIDs) ? participantIDs : []),
        Number(unreadCount ?? 0),
        Number(messageCount ?? 0),
        emoji ?? null,
        color ?? null,
        threadTheme ?? null,
        JSON.stringify(nicknames && typeof nicknames === 'object' ? nicknames : {}),
        JSON.stringify(Array.isArray(adminIDs) ? adminIDs : []),
        approvalMode ? 1 : 0,
        JSON.stringify(Array.isArray(approvalQueue) ? approvalQueue : []),
        imageSrc ?? null,
        threadType ?? null,
        JSON.stringify(extra && typeof extra === 'object' ? extra : {})
      ], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async delete(threadID) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM threads WHERE threadID = ?', [threadID], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM threads', (error, rows) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(rows.map(row => ({
          threadID: row.threadID,
          threadName: row.threadName,
          participantIDs: this.parseJSON(row.participantIDs, []),
          unreadCount: Number(row.unreadCount ?? 0),
          messageCount: Number(row.messageCount ?? 0),
          emoji: row.emoji,
          color: row.color,
          threadTheme: row.threadTheme,
          nicknames: this.parseJSON(row.nicknames, {}),
          adminIDs: this.parseJSON(row.adminIDs, []),
          approvalMode: Boolean(row.approvalMode),
          approvalQueue: this.parseJSON(row.approvalQueue, []),
          imageSrc: row.imageSrc,
          threadType: row.threadType,
          extra: this.parseJSON(row.extra, {})
        })));
      });
    });
  }
}

export default Threads;