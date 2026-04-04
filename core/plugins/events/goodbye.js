export const config = {
  name: "goodbye",
  eventType: ["log:unsubscribe"]
};

export async function call(context) {
  const { logMessageData, threadID, api } = context;
  
  if (!logMessageData || !logMessageData.leftParticipantFbId) return;
  
  const leftUserID = logMessageData.leftParticipantFbId;
  
  if (!leftUserID) return;
  
  try {
    const isBot = leftUserID === api.getCurrentUserID();
    
    let userName = "thành viên";
    
    if (!isBot) {
      const userData = global.data.userData.get(leftUserID);
      if (userData && userData.name) {
        userName = userData.name;
      } else {
        try {
          const userInfo = await api.getUserInfo(leftUserID);
          if (userInfo && userInfo[leftUserID]) {
            userName = userInfo[leftUserID].name;
          }
        } catch (error) {
          logger.error('Failed to get user info:', error);
        }
      }
    }
    
    const threadInfo = await api.getThreadInfo(threadID);
    const threadName = threadInfo.threadName || "nhóm";
    
    const goodbyeMessages = [
      `👋 ${userName} đã rời ${threadName}. Hẹn gặp lại bạn!`,
      `💔 ${userName} vừa rời khỏi ${threadName}. Buồn quá!`,
      `😢 ${userName} đã rời nhóm. Mong bạn sẽ quay lại!`,
      `🍃 ${userName} đã rời ${threadName}. Chúc bạn nhiều may mắn!`,
      `🌊 ${userName} đã rời đi. Hẹn gặp lại ở một nơi khác!`,
      `📝 ${userName} đã rời ${threadName}. Tạm biệt nhé!`
    ];
    
    const randomIndex = Math.floor(Math.random() * goodbyeMessages.length);
    let goodbyeMessage = goodbyeMessages[randomIndex];
    
    const memberCount = threadInfo.participantIDs ? threadInfo.participantIDs.length : 0;
    goodbyeMessage += `\n📊 Thành viên hiện tại: ${memberCount}`;
    
    if (isBot) {
      goodbyeMessage = `🤖 Bot đã rời ${threadName}.\nCảm ơn bạn đã sử dụng bot!`;
    }
    
    await api.sendMessage(goodbyeMessage, threadID);
    
    if (!isBot && threadInfo.participantIDs) {
      const currentParticipants = global.data.allThreadID.get(threadID) || [];
      const updatedParticipants = currentParticipants.filter(id => id !== leftUserID);
      global.data.allThreadID.set(threadID, updatedParticipants);
      
      if (global.database && global.database.threads) {
        const threadData = global.data.threadData.get(threadID);
        if (threadData) {
          threadData.participantIDs = updatedParticipants;
          await global.database.threads.set(threadID, threadData);
        }
      }
    }
  } catch (error) {
    logger.error('Error in goodbye event:', error);
  }
}