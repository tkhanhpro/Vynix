export const config = {
  name: "setprefix",
  alias: ["setprefix"],
  role: 1,
  info: "Đổi prefix của bot trong nhóm",
  guide: "setprefix <dấu lệnh mới>",
  cd: 2,
  prefix: true
};

export async function call(context) {
  const { event, threadID, args, reply } = context;

  const threadData = global.data.threadData.get(threadID);
  const currentPrefix = threadData?.extra?.prefix || global.config.prefix;

  if (args.length === 0) {
    return reply(`🔧 Prefix hiện tại của nhóm là: ${currentPrefix}\n\nĐể đổi prefix, dùng: ${currentPrefix}setprefix <dấu lệnh mới>\nVí dụ: ${currentPrefix}setprefix !`
    );
  }

  const newPrefix = args[0];

  try {
    if (!threadData) {
      return reply('❌ Không tìm thấy dữ liệu nhóm trong bộ nhớ!');
    }

    threadData.extra = {
      ...(threadData.extra || {}),
      prefix: newPrefix
    };

    await global.database.threads.set(threadID, threadData);
    global.data.threadData.set(threadID, threadData);

    return reply(`✅ Đã đổi prefix thành công!\n\nPrefix mới của bot trong nhóm này là: ${newPrefix}\n\nVí dụ: ${newPrefix}help`
    );
  } catch (error) {
    console.error('Lỗi setprefix:', error);
    return reply('❌ Đã xảy ra lỗi khi đổi prefix!');
  }
}