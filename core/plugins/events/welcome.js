import logger from '../../utils/logger.js';

export const config = {
  name: "welcome",
  eventType: ["log:subscribe"]
};

export async function call(context) {
  const { logMessageData, threadID, api } = context;
  
  if (!logMessageData || !logMessageData.addedParticipants) return;
  
  const addedParticipants = logMessageData.addedParticipants;
  
  if (!addedParticipants || addedParticipants.length === 0) return;
  
  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const threadName = threadInfo.threadName || "nhóm";
    
    for (const participant of addedParticipants) {
      const userID = participant.userFbId || participant.id;
      
      if (!userID) continue;
      
      const isBot = userID === api.getCurrentUserID();
      
      let userName = participant.fullName || participant.name;
      
      if (!userName) {
        try {
          const userInfo = await api.getUserInfo(userID);
          if (userInfo && userInfo[userID]) {
            userName = userInfo[userID].name;
          } else {
            userName = "thành viên mới";
          }
        } catch (error) {
          userName = "thành viên mới";
        }
      }
      
      const welcomeMessages = [
        `🌸 Chào mừng ${userName} đã tham gia ${threadName}!`,
        `✨ ${userName} vừa bước vào ${threadName}. Chào mừng bạn!`,
        `🎉 Chào mừng ${userName} đến với ${threadName}! Chúc bạn vui vẻ!`,
        `💝 ${userName} đã gia nhập ${threadName}. Cùng nhau xây dựng nhé!`,
        `🌺 ${userName} ơi, chào mừng bạn đến với ${threadName}!`,
        `⭐ ${userName} đã tham gia ${threadName}. Hy vọng bạn có những phút giây vui vẻ!`
      ];
      
      const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
      let welcomeMessage = welcomeMessages[randomIndex];
      
      const memberCount = threadInfo.participantIDs ? threadInfo.participantIDs.length : 0;
      welcomeMessage += `\n📊 Thành viên hiện tại: ${memberCount}`;
      
      if (isBot) {
        welcomeMessage = `🤖 Bot đã tham gia ${threadName}!\nSử dụng ${global.config.prefix}help để xem danh sách lệnh.`;
      }
      
      await api.sendMessage(welcomeMessage, threadID);
      
      if (!isBot && global.data.currencyData) {
        try {
          const existingMoney = global.data.currencyData.get(userID);
          if (!existingMoney) {
            await global.database.currencies.set(userID, { userID, money: 1000 });
            global.data.currencyData.set(userID, { userID, money: 1000 });
            await api.sendMessage(`🎁 Tặng bạn 1000 xu khi tham gia nhóm!`, threadID);
          }
        } catch (error) {
          logger.error('Failed to give welcome bonus:', error);
        }
      }
      
      if (threadInfo.participantIDs) {
        const currentParticipants = global.data.allThreadID.get(threadID) || [];
        const newParticipants = [...new Set([...currentParticipants, userID])];
        global.data.allThreadID.set(threadID, newParticipants);
        
        if (global.database && global.database.threads) {
          const threadData = global.data.threadData.get(threadID);
          if (threadData) {
            threadData.participantIDs = newParticipants;
            await global.database.threads.set(threadID, threadData);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error in welcome event:', error);
  }
}