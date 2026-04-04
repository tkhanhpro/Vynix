export const config = {
  name: "setmoney",
  alias: ["setbal", "setxu"],
  role: 3,
  info: "Quản lý tiền người dùng (add/del/all)",
  guide: "setmoney <add|del|all> <@tag hoặc userID> <số tiền>",
  cd: 5,
  prefix: true
};

export async function call(context) {
  const { api, event, threadID, messageID, senderID, args, reply, mentions, messageReply } = context;
  
  if (args.length < 2) {
    await reply(`❌ Sai cú pháp!\n\n` +
      `Sử dụng:\n` +
      `• ${global.config.prefix}setmoney add <@tag hoặc userID> <số tiền> - Thêm tiền\n` +
      `• ${global.config.prefix}setmoney del <@tag hoặc userID> <số tiền> - Xóa tiền\n` +
      `• ${global.config.prefix}setmoney all <số tiền> - Thêm tiền toàn bộ thành viên trong nhóm\n\n` +
      `Ví dụ:\n` +
      `• ${global.config.prefix}setmoney add @user 10000\n` +
      `• ${global.config.prefix}setmoney del @user 5000\n` +
      `• ${global.config.prefix}setmoney all 1000`);
    return;
  }
  
  const action = args[0].toLowerCase();
  
  if (action === 'all') {
    const amount = parseInt(args[1]);
    
    if (isNaN(amount) || amount <= 0) {
      await reply('❌ Số tiền không hợp lệ!');
      return;
    }
    
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      const participants = threadInfo.participantIDs;
      
      if (!participants || participants.length === 0) {
        await reply('❌ Không tìm thấy thành viên trong nhóm!');
        return;
      }
      
      let successCount = 0;
      let failCount = 0;
      
      for (const userID of participants) {
        try {
          let currencyData = global.data.currencyData.get(userID);
          
          if (!currencyData) {
            currencyData = { userID: userID, money: 0 };
          }
          
          const oldMoney = currencyData.money || 0;
          currencyData.money = oldMoney + amount;
          
          await global.database.currencies.set(userID, currencyData);
          global.data.currencyData.set(userID, currencyData);
          successCount++;
          
        } catch (error) {
          failCount++;
          console.error(`Lỗi khi thêm tiền cho user ${userID}:`, error);
        }
      }
      
      await reply(`✅ THÊM TIỀN TOÀN BỘ THÀNH CÔNG!\n\n` +
                  `👥 Số thành viên: ${participants.length}\n` +
                  `✅ Thành công: ${successCount}\n` +
                  `❌ Thất bại: ${failCount}\n` +
                  `➕ Mỗi người được thêm: ${amount.toLocaleString()} xu`);
      
    } catch (error) {
      console.error('Lỗi setmoney all:', error);
      await reply('❌ Đã xảy ra lỗi khi thêm tiền cho toàn bộ thành viên!');
    }
    return;
  }
  
  if (action !== 'add' && action !== 'del') {
    await reply(`❌ Hành động không hợp lệ! Dùng add, del hoặc all`);
    return;
  }
  
  if (args.length < 3) {
    await reply(`❌ Thiếu tham số!\n\nSử dụng: ${global.config.prefix}setmoney ${action} <@tag hoặc userID> <số tiền>`);
    return;
  }
  
  let targetID = senderID;
  let amount = null;
  let targetName = null;
  
  if (messageReply) {
    targetID = messageReply.senderID;
    amount = parseInt(args[args.length - 1]);
  }
  
  if (mentions) {
    const mentionKeys = Object.keys(mentions);
    if (mentionKeys.length > 0) {
      targetID = mentionKeys[0];
      targetName = mentions[targetID];
      amount = parseInt(args[args.length - 1]);
    }
  }
  
  if (!targetID || isNaN(amount) || amount <= 0) {
    const possibleAmount = parseInt(args[1]);
    if (!isNaN(possibleAmount) && possibleAmount > 0) {
      amount = possibleAmount;
      targetID = senderID;
    } else {
      await reply('❌ User ID không hợp lệ hoặc số tiền không đúng!');
      return;
    }
  }
  
  try {
    let currencyData = global.data.currencyData.get(targetID);
    
    if (!currencyData) {
      currencyData = { userID: targetID, money: 0 };
    }
    
    const oldMoney = currencyData.money || 0;
    let newMoney = oldMoney;
    let message = '';
    
    if (action === 'add') {
      newMoney = oldMoney + amount;
      message = `✅ CỘNG TIỀN THÀNH CÔNG!\n\n` +
                `👤 Người dùng: ${targetName || targetID}\n` +
                `🆔 User ID: ${targetID}\n` +
                `➕ Đã thêm: ${amount.toLocaleString()} xu\n` +
                `💰 Số dư cũ: ${oldMoney.toLocaleString()} xu\n` +
                `💵 Số dư mới: ${newMoney.toLocaleString()} xu`;
    } else if (action === 'del') {
      newMoney = Math.max(0, oldMoney - amount);
      const deducted = oldMoney - newMoney;
      message = `✅ TRỪ TIỀN THÀNH CÔNG!\n\n` +
                `👤 Người dùng: ${targetName || targetID}\n` +
                `🆔 User ID: ${targetID}\n` +
                `➖ Đã trừ: ${deducted.toLocaleString()} xu\n` +
                `💰 Số dư cũ: ${oldMoney.toLocaleString()} xu\n` +
                `💵 Số dư mới: ${newMoney.toLocaleString()} xu`;
    }
    
    currencyData.money = newMoney;
    
    await global.database.currencies.set(targetID, currencyData);
    global.data.currencyData.set(targetID, currencyData);
    
    await reply(message);
    
  } catch (error) {
    console.error('Lỗi setmoney:', error);
    await reply('❌ Đã xảy ra lỗi khi thực hiện!');
  }
}