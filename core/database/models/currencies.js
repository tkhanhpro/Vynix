class Currencies {
  constructor(db) {
    this.db = db;
  }
  
  async initTable() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS currencies (
          userID TEXT PRIMARY KEY,
          money INTEGER DEFAULT 0,
          updatedAt INTEGER
        )
      `, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  
  async get(userID) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM currencies WHERE userID = ?', [userID], (error, row) => {
        if (error) reject(error);
        else resolve(row);
      });
    });
  }
  
  async set(userID, data) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO currencies (userID, money, updatedAt)
        VALUES (?, ?, ?)
      `, [userID, data.money || 0, Date.now()], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  
  async add(userID, amount) {
    const current = await this.get(userID);
    const newAmount = (current ? current.money : 0) + amount;
    return this.set(userID, { money: newAmount });
  }
  
  async subtract(userID, amount) {
    const current = await this.get(userID);
    const newAmount = Math.max(0, (current ? current.money : 0) - amount);
    return this.set(userID, { money: newAmount });
  }
  
  async delete(userID) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM currencies WHERE userID = ?', [userID], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  
  async getAll() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM currencies', (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
  }
}

export default Currencies;