export const config = {
  name: "example",
  alias: ["ex"],
  role: 0,
  info: "Ví dụ lệnh có cả reply và reaction",
  guide: "example",
  cd: 2,
  prefix: true
};

export async function call(context) {
  const { api, threadID, senderID } = context;
  
  const msg = await api.sendMessage(
    "🔔 VÍ DỤ REPLY & REACTION\n\n" +
    "📝 Reply: Reply tin nhắn này\n" +
    "👍 Reaction: Thả 👍 vào tin nhắn này\n\n" +
    "⏱️ Hết hạn sau 30 giây",
    threadID
  );
  
  global.client.onReply.push({
    author: senderID,
    messageID: msg.messageID,
    callback: async (ctx) => {
      await ctx.api.sendMessage(
        "✅ REPLY\nNội dung: " + ctx.body,
        ctx.threadID
      );
    }
  });
  
  global.client.onReaction.push({
    messageID: msg.messageID,
    callback: async (ctx) => {
      if (ctx.reaction === '👍') {
        await ctx.api.sendMessage(
          "✅ REACTION\nBạn đã thả 👍",
          ctx.threadID
        );
      }
    },
    oneTime: true
  });
  
  setTimeout(async () => {
    let cleaned = false;
    
    const replyIndex = global.client.onReply.findIndex(r => r.messageID === msg.messageID);
    if (replyIndex !== -1) {
      global.client.onReply.splice(replyIndex, 1);
      cleaned = true;
    }
    
    const reactionIndex = global.client.onReaction.findIndex(r => r.messageID === msg.messageID);
    if (reactionIndex !== -1) {
      global.client.onReaction.splice(reactionIndex, 1);
      cleaned = true;
    }
    
    if (cleaned) {
      await api.sendMessage("⏰ Hết thời gian test", threadID);
    }
  }, 30000);
}