class Users {
  constructor(db) {
    this.db = db;
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row);
      });
    });
  }

  async initTable() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        userID TEXT PRIMARY KEY,
        name TEXT,
        firstName TEXT,
        vanity TEXT,
        thumbSrc TEXT,
        profileUrl TEXT,
        gender TEXT,
        isFriend INTEGER,
        isBirthday INTEGER
      )
    `);

    const columns = await this.all(`PRAGMA table_info(users)`);
    const columnNames = new Set(columns.map(column => column.name));

    const missingColumns = [
      ['thumbSrc', 'TEXT'],
      ['profileUrl', 'TEXT'],
      ['isBirthday', 'INTEGER']
    ].filter(([name]) => !columnNames.has(name));

    for (const [name, type] of missingColumns) {
      await this.run(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    }
  }

  async get(userID) {
    const row = await this.getRow(userID);
    if (!row) return null;

    return {
      name: row.name,
      firstName: row.firstName,
      vanity: row.vanity,
      thumbSrc: row.thumbSrc,
      profileUrl: row.profileUrl,
      gender: row.gender,
      isFriend: Boolean(row.isFriend),
      isBirthday: Boolean(row.isBirthday)
    };
  }

  async getRow(userID) {
    return this.get(
      `
        SELECT 
          name,
          firstName,
          vanity,
          thumbSrc,
          profileUrl,
          gender,
          isFriend,
          isBirthday
        FROM users
        WHERE userID = ?
      `,
      [userID]
    );
  }

  async set(userID, data) {
    const {
      name,
      firstName,
      vanity,
      thumbSrc,
      profileUrl,
      gender,
      isFriend,
      isBirthday
    } = data;

    await this.run(
      `
        INSERT OR REPLACE INTO users (
          userID,
          name,
          firstName,
          vanity,
          thumbSrc,
          profileUrl,
          gender,
          isFriend,
          isBirthday
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userID,
        name ?? null,
        firstName ?? null,
        vanity ?? null,
        thumbSrc ?? null,
        profileUrl ?? null,
        gender ?? null,
        isFriend ? 1 : 0,
        isBirthday ? 1 : 0
      ]
    );
  }

  async delete(userID) {
    await this.run('DELETE FROM users WHERE userID = ?', [userID]);
  }

  async getAll() {
    const rows = await this.all(`
      SELECT
        userID,
        name,
        firstName,
        vanity,
        thumbSrc,
        profileUrl,
        gender,
        isFriend,
        isBirthday
      FROM users
    `);

    return rows.map(row => ({
      userID: row.userID,
      name: row.name,
      firstName: row.firstName,
      vanity: row.vanity,
      thumbSrc: row.thumbSrc,
      profileUrl: row.profileUrl,
      gender: row.gender,
      isFriend: Boolean(row.isFriend),
      isBirthday: Boolean(row.isBirthday)
    }));
  }
}

export default Users;