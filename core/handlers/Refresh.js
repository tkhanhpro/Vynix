class RefreshHandler {
  async refreshUser(userID) {
    try {
      const { database, data, api, logger } = global;
      const usersDb = database?.users;
      const userData = data?.userData;

      if (!usersDb || !userData) return null;

      const cachedUser = userData.get(userID);
      if (cachedUser) return cachedUser;

      const userInfo = await api.getUserInfo(userID);
      const user = userInfo?.[userID];

      if (!user) return null;

      const normalizedUser = {
        name: user.name ?? null,
        firstName: user.firstName ?? null,
        vanity: user.vanity ?? null,
        thumbSrc: user.thumbSrc ?? null,
        profileUrl: user.profileUrl ?? null,
        gender: user.gender ?? null,
        isFriend: Boolean(user.isFriend),
        isBirthday: Boolean(user.isBirthday)
      };

      await usersDb.set(userID, normalizedUser);
      userData.set(userID, normalizedUser);

      logger.info(`Thêm người dùng mới vào database: ${normalizedUser.name || userID} (ID: ${userID})`);
      return normalizedUser;
    } catch (error) {
      global.logger.error(`Lỗi khi lưu người dùng ${userID}:`, error);
      return null;
    }
  }

  async refreshThread(threadID) {
    try {
      const { database, data, api, logger } = global;
      const threadsDb = database?.threads;
      const threadDataMap = data?.threadData;
      const allThreadID = data?.allThreadID;
      const userData = data?.userData;

      if (!threadsDb || !threadDataMap || !allThreadID || !userData) return null;

      const cachedThread = threadDataMap.get(threadID);
      if (cachedThread) return cachedThread;

      const threadInfo = await api.getThreadInfo(threadID);
      if (!threadInfo) return null;

      const normalizedThread = {
        threadName: threadInfo.threadName ?? null,
        participantIDs: Array.isArray(threadInfo.participantIDs) ? threadInfo.participantIDs : [],
        unreadCount: Number(threadInfo.unreadCount ?? 0),
        messageCount: Number(threadInfo.messageCount ?? 0),
        emoji: threadInfo.emoji ?? null,
        color: threadInfo.color ?? null,
        threadTheme: threadInfo.threadTheme ?? null,
        nicknames: threadInfo.nicknames && typeof threadInfo.nicknames === 'object' ? threadInfo.nicknames : {},
        adminIDs: Array.isArray(threadInfo.adminIDs) ? threadInfo.adminIDs : [],
        approvalMode: Boolean(threadInfo.approvalMode),
        approvalQueue: Array.isArray(threadInfo.approvalQueue) ? threadInfo.approvalQueue : [],
        imageSrc: threadInfo.imageSrc ?? null,
        threadType: threadInfo.threadType ?? null,
        extra: {}
      };

      await threadsDb.set(threadID, normalizedThread);
      threadDataMap.set(threadID, normalizedThread);
      allThreadID.set(threadID, normalizedThread.participantIDs);

      for (const participant of normalizedThread.participantIDs) {
        if (!userData.has(participant)) {
          await this.refreshUser(participant);
        }
      }

      logger.info(`Thêm nhóm mới vào database: ${normalizedThread.threadName || threadID} (ID: ${threadID})`);
      return normalizedThread;
    } catch (error) {
      global.logger.error(`Lỗi khi thêm nhóm ${threadID}:`, error);
      return null;
    }
  }

  async refreshCurrency(userID) {
    try {
      const { database, data, logger } = global;
      const currenciesDb = database?.currencies;
      const currencyData = data?.currencyData;

      if (!currenciesDb || !currencyData) {
        logger.error('Số dư của người dùng không được đồng bộ');
        return null;
      }

      const cachedCurrency = currencyData.get(userID);
      if (cachedCurrency) return cachedCurrency;

      const newCurrencyData = {
        userID,
        money: 0
      };

      await currenciesDb.set(userID, newCurrencyData);
      currencyData.set(userID, newCurrencyData);

      logger.info(`Khởi tạo số dư cho người dùng: ${userID}`);
      return newCurrencyData;
    } catch (error) {
      global.logger.error(`Lỗi khi khởi tạo số cho dư người dùng ${userID}:`, error);
      return null;
    }
  }

  async handleParticipants(threadID, participantIDs) {
    if (!Array.isArray(participantIDs) || participantIDs.length === 0) return;

    const { data } = global;
    const userData = data?.userData;
    const currencyData = data?.currencyData;

    if (!userData || !currencyData) return;

    for (const userID of participantIDs) {
      if (!userData.has(userID)) {
        await this.refreshUser(userID);
      }

      if (!currencyData.has(userID)) {
        await this.refreshCurrency(userID);
      }
    }
  }

  async checkAndRefresh(senderID, threadID, participantIDs = null) {
    try {
      const { database, data, logger } = global;

      if (!database || !data) {
        logger.error('Database chưa được đồng bộ');
        return;
      }

      const userData = data.userData;
      const currencyData = data.currencyData;
      const threadData = data.threadData;
      const allThreadID = data.allThreadID;

      if (senderID) {
        if (!userData.has(senderID)) {
          await this.refreshUser(senderID);
        }

        if (!currencyData.has(senderID)) {
          await this.refreshCurrency(senderID);
        }
      }

      if (threadID) {
        if (!threadData.has(threadID)) {
          await this.refreshThread(threadID);
        }

        const participants = participantIDs || allThreadID.get(threadID);
        if (Array.isArray(participants) && participants.length > 0) {
          await this.handleParticipants(threadID, participants);
        }
      }
    } catch (error) {
      global.logger.error('Error in checkAndRefresh:', error);
    }
  }
}

export default RefreshHandler;