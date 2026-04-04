class DatabaseHandler {
  async loadData() {
    const users = await global.database.users.getAll();
    users.forEach(user => {
      global.data.userData.set(user.userID, user);
    });
    
    const threads = await global.database.threads.getAll();
    threads.forEach(thread => {
      global.data.threadData.set(thread.threadID, thread);
      if (thread.participantIDs) {
        global.data.allThreadID.set(thread.threadID, thread.participantIDs);
      }
    });
    
    const currencies = await global.database.currencies.getAll();
    currencies.forEach(currency => {
      global.data.currencyData.set(currency.userID, currency);
    });
  }
}

export default DatabaseHandler;