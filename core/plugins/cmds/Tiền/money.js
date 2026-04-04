export const config = {
  name: "money",
  alias: ["money"],
  role: 0,
  info: "Kiểm tra số tiền hiện có",
  guide: "money [@tag hoặc reply]",
  cd: 2,
  prefix: true
};

export async function call(context) {
  const { api, event, senderID, reply, messageReply, mentions } = context;

  let targetID;
  if (messageReply) {
    targetID = messageReply.senderID;
  } else if (mentions && Object.keys(mentions).length > 0) {
    targetID = Object.keys(mentions)[0];
  } else {
    targetID = senderID;
  }

  try {
    let currencyData = global.data.currencyData.get(targetID);

    if (!currencyData) {
      currencyData = { userID: targetID, money: 0 };
      await global.database.currencies.set(targetID, currencyData);
      global.data.currencyData.set(targetID, currencyData);
    }

    const data = await global.data.userData.get(targetID);
    const userName = data.name || 'Người dùng Facebook';
    const money = currencyData.money || 0;

    let msg = `👤 Tên: ${userName}\n`;
    msg += `💵 Số tiền: ${money.toLocaleString()} VND`;

    return reply(msg);

  } catch (e) {
    if (e) return console.error(e);
    return reply(`❌ Lỗi: \n${e.message}`);
  }
}