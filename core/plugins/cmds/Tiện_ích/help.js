import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  name: "help",
  alias: ["menu"],
  role: 0,
  info: "Xem danh sách lệnh hoặc thông tin chi tiết về một lệnh",
  guide: "help [tên lệnh]",
  cd: 2,
  prefix: true
};

const COMMANDS_DIR = join(process.cwd(), 'core', 'plugins', 'cmds');

const ROLE_TEXT = {
  0: "Thành viên",
  1: "Quản trị viên nhóm",
  2: "Admin bot",
  3: "Chủ bot"
};

function readDirectoryItems(dir) {
  return fs.readdirSync(dir);
}

function getFullPath(dir, item) {
  return path.join(dir, item);
}

function getPathStat(targetPath) {
  return fs.statSync(targetPath);
}

function isCommandFile(fileName) {
  return fileName.endsWith('.js');
}

function getCommandNameFromFile(fileName) {
  return fileName.replace('.js', '');
}

function findCategoryByCommandName(dir, targetName) {
  const items = readDirectoryItems(dir);

  for (const item of items) {
    const fullPath = getFullPath(dir, item);
    const stat = getPathStat(fullPath);

    if (stat.isDirectory()) {
      const result = findCategoryByCommandName(fullPath, targetName);
      if (result) return result;
      continue;
    }

    if (stat.isFile() && item === `${targetName}.js`) {
      const relativePath = path.relative(COMMANDS_DIR, fullPath);
      const category = path.dirname(relativePath);
      return category === '.' ? 'Khác' : category;
    }
  }

  return null;
}

function getCommandCategory(commandName) {
  return findCategoryByCommandName(COMMANDS_DIR, commandName) || 'Khác';
}

function findCommandByNameOrAlias(commandName) {
  for (const [name, cmd] of global.client.commands) {
    const aliases = cmd.config.alias || [];
    if (name === commandName || aliases.includes(commandName)) {
      return { name, command: cmd };
    }
  }

  return null;
}

function formatCommandDetail(command, commandName) {
  const category = command.config.ctg || getCommandCategory(commandName);

  return (
    `📋 Thông tin lệnh 📋\n\n` +
    `🔖 Tên: ${command.config.name}\n` +
    `🔗 Tên khác: ${command.config.alias ? command.config.alias.join(', ') : 'Không có'}\n` +
    `📝 Mô tả: ${command.config.info || 'Không có mô tả'}\n` +
    `👥 Nhóm: ${category}\n` +
    `🎯 Cách dùng: ${command.config.guide}\n` +
    `⚡ Quyền hạn: ${ROLE_TEXT[command.config.role] || 'Thành viên'}\n` +
    `⏱️ Thời gian chờ: ${command.config.cd || 0} giây`
  );
}

function addCommandToCategory(categories, category, commandName) {
  if (!categories.has(category)) {
    categories.set(category, []);
  }

  categories.get(category).push(commandName);
}

function buildCategoryMap(dir, categories, currentCategory = '') {
  const items = readDirectoryItems(dir);

  for (const item of items) {
    const fullPath = getFullPath(dir, item);
    const stat = getPathStat(fullPath);

    if (stat.isDirectory()) {
      const nextCategory = currentCategory ? `${currentCategory}/${item}` : item;
      buildCategoryMap(fullPath, categories, nextCategory);
      continue;
    }

    if (!stat.isFile() || !isCommandFile(item)) continue;

    const commandName = getCommandNameFromFile(item);
    const command = global.client.commands.get(commandName);

    if (!command) continue;

    let category = currentCategory;

    if (command.config.ctg) {
      category = command.config.ctg;
    } else if (!category) {
      category = 'Khác';
    }

    addCommandToCategory(categories, category, commandName);
  }
}

function seedCustomCategories(categories) {
  for (const [name, cmd] of global.client.commands) {
    if (!cmd.config.ctg) continue;
    addCommandToCategory(categories, cmd.config.ctg, name);
  }
}

function formatMenu(categories, prefix) {
  let menu = `📋 Danh sách lệnh 📋\n\n`;
  const sortedCategories = Array.from(categories.keys()).sort();

  for (const category of sortedCategories) {
    const commands = categories.get(category);
    menu += `📁 ${category.toUpperCase()}\n`;
    menu += `${commands.map(cmd => `• ${cmd}`).join('\n')}\n\n`;
  }

  menu += `💡 Sử dụng: ${prefix}help <tên lệnh> để xem chi tiết thông tin lệnh`;
  return menu;
}

async function sendCommandDetail(api, threadID, messageID, commandName) {
  const found = findCommandByNameOrAlias(commandName);

  if (!found) {
    await api.sendMessage(`❌ Không tìm thấy lệnh "${commandName}"`, threadID, messageID);
    return;
  }

  const info = formatCommandDetail(found.command, found.name);
  await api.sendMessage(info, threadID, messageID);
}

async function sendCommandList(api, threadID, messageID) {
  const categories = new Map();
  const data = await global.data.threadData.get(threadID) || {};
  const prefix = data.extra.prefix || global.config.prefix;

  seedCustomCategories(categories);
  buildCategoryMap(COMMANDS_DIR, categories);

  const menu = formatMenu(categories, prefix);
    
  await api.sendMessage(menu, threadID, messageID);
}

export async function call(context) {
  const { api, threadID, messageID, args } = context;

  if (args.length > 0) {
    const commandName = args[0].toLowerCase();
    await sendCommandDetail(api, threadID, messageID, commandName);
    return;
  }

  await sendCommandList(api, threadID, messageID);
}