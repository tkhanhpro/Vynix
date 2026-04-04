export const config = {
  name: "upt",
  alias: ["uptime"],
  role: 0,
  info: "Xem thời gian bot đã hoạt động",
  guide: "upt",
  cd: 2,
  prefix: true
};

export async function call(context) {
  const { reply } = context;
  
  if (!global.client.startTime) {
    global.client.startTime = Date.now();
  }
  
  const uptime = Date.now() - global.client.startTime;
  
  const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
  const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((uptime % (60 * 1000)) / 1000);
  
  const memoryUsage = process.memoryUsage();
  const memoryUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
  const memoryTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
  
  const cpuUsage = process.cpuUsage();
  const cpuUser = (cpuUsage.user / 1000000).toFixed(2);
  const cpuSystem = (cpuUsage.system / 1000000).toFixed(2);
  
  let uptimeString = '';
  if (days > 0) uptimeString += days + ' ngày ';
  if (hours > 0) uptimeString += hours + ' giờ ';
  if (minutes > 0) uptimeString += minutes + ' phút ';
  uptimeString += seconds + ' giây';
  
  const statusMessage = 
    "⏱️ 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐔𝐒 ⏱️\n" +
    "━━━━━━━━━━━━━━━━━━━\n" +
    "⏰ Uptime Info ⏰\n" +
    "├─ ⏳ Bot hoạt động: " + uptimeString + "\n" +
    "├─ 🚀 Khởi động lúc: " + new Date(global.client.startTime).toLocaleString('vi-VN') + "\n" +
    "└─ ⏰ Hiện tại: " + new Date().toLocaleString('vi-VN') + "\n\n" +
    "💾 Memory Usage 💾\n" +
    "├─ 📦 Heap Used: " + memoryUsed + " MB\n" +
    "├─ 🗄️ Heap Total: " + memoryTotal + " MB\n" +
    "└─ 💿 RSS: " + (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB\n\n" +
    "📈 Database Stats 📈\n" +
    "├─ 📝 Commands: " + global.client.commands.size + "\n" +
    "├─ 🎯 Events: " + global.client.events.size + "\n" +
    "├─ 👥 Users: " + global.data.userData.size + "\n" +
    "├─ 💬 Threads: " + global.data.threadData.size + "\n" +
    "└─ 💰 Currency: " + global.data.currencyData.size + "\n\n" +
    "🤖 Bot Info 🤖\n" +
    "├─ 🏷️ Name: " + global.config.name + "\n" +
    "├─ 🔧 Prefix: " + global.config.prefix + "\n" +
    "├─ 🛠️ Dev Mode: " + (global.config.devMode ? '✅ Bật' : '❌ Tắt') + "\n" +
    "├─ 📦 Node.js: " + process.version + "\n" +
    "└─ 💻 Platform: " + process.platform + "\n" +
    "━━━━━━━━━━━━━━━━━━━";
  
  return reply(statusMessage);
}