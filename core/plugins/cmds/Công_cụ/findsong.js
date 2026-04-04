import axios from 'axios';

export const config = {
  name: "findsong",
  alias: ["timnhac", "findmusic"],
  role: 0,
  info: "Tìm thông tin bài hát từ audio/video",
  guide: "reply vào audio/video để tìm bài hát",
  cd: 2,
  prefix: true
};

export async function call(context) {
  const { api, event, threadID, messageID, senderID, reply, react, messageReply } = context;
  
  try {
    if (!messageReply || !messageReply.attachments || !messageReply.attachments.length || !messageReply.attachments[0]) {
      await reply("⚠️ Hãy reply audio/video để tìm bài hát");
      return;
    }
    
    const url = messageReply.attachments[0].url;
    
    await api.setMessageReaction("⏳", messageID, threadID);
    
    const res = await axios.get("https://lvdpurple.site/api/findSong", { 
      params: { url, author: "LunarKrystal" } 
    });
    const data = res.data;
    
    if (data.status !== "success") {
      await api.setMessageReaction("❌", messageID, threadID);
      await reply("❌ Không tìm thấy bài hát tương tự");
      return;
    }
    
    const msg = await api.sendMessage(
      `🎵 THÔNG TIN BÀI HÁT\n\n` +
      `📌 Tiêu đề: ${data.title}\n` +
      `🎤 Nghệ sĩ: ${data.artist}\n` +
      `💿 Album: ${data.album}\n` +
      `📅 Năm phát hành: ${data.year}\n\n` +
      `👍 Thả cảm xúc vào tin nhắn này để phát bài hát đã tìm`,
      threadID
    );
    
    await api.setMessageReaction("✅", messageID, threadID);
    
    global.client.onReaction.push({
      messageID: msg.messageID,
      author: senderID,
      callback: async (ctx) => {
        if (ctx.userID !== senderID) return;
        
        await api.unsendMessage(msg.messageID);
        
        const singCommand = global.client.commands.get("sing");
        
        if (singCommand) {
          const newContext = {
            ...context,
            args: [data.title],
            reply: async (msg) => {
              return api.sendMessage(msg, context.threadID, context.messageID);
            }
          };
          
          await singCommand.call(newContext);
        } else {
          await ctx.reply("❌ Không tìm thấy lệnh sing!");
        }
      },
      oneTime: true
    });
    
  } catch (err) {
    console.error('Lỗi findsong:', err);
    await api.setMessageReaction("❌", messageID, threadID);
    await reply("❌ Lỗi khi tìm bài hát");
  }
}