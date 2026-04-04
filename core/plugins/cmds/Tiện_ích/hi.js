export const config = {
  name: "hi",
  alias: ["hello", "chao"],
  role: 0,
  info: "Gửi lời chào",
  guide: "hi",
  cd: 2,
  prefix: true
};

export async function call(context) {
  const { senderID, reply } = context;
  
  const data = await global.data.userData.get(senderID);
  const userName = data.name || "Người dùng Facebook";
  
  return reply(`Xin chào ${userName}, chúc bạn một ngày vui vẻ 🥰`);
}