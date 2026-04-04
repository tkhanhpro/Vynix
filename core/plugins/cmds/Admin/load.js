import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  name: "load",
  alias: ["l"],
  role: 3,
  info: "Load plugin",
  guide: "load <c|e|f> <filename || a/all>",
  cd: 2,
  prefix: false
};

function findFileInCommands(dir, fileName, excludeDirs = ['node_modules', '.npm', '.cache', '.git']) {
  if (!fs.existsSync(dir)) return null;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (excludeDirs.includes(item)) continue;
      const result = findFileInCommands(fullPath, fileName, excludeDirs);
      if (result) return result;
    } else if (stat.isFile() && item === fileName + '.js') {
      return fullPath;
    }
  }
  
  return null;
}

function getAllJsFiles(dir, excludeDirs = ['node_modules', '.npm', '.cache', '.git']) {
  let jsFiles = [];
  
  if (!fs.existsSync(dir)) return jsFiles;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (excludeDirs.includes(item)) continue;
      jsFiles = jsFiles.concat(getAllJsFiles(fullPath, excludeDirs));
    } else if (stat.isFile() && item.endsWith('.js') && !item.startsWith('_')) {
      jsFiles.push(fullPath);
    }
  }
  
  return jsFiles;
}

function getRelativePath(filePath, cmdsDir) {
  const relative = path.relative(cmdsDir, filePath);
  const folder = path.dirname(relative) === '.' ? null : path.dirname(relative);
  return { relative, folder };
}

export async function call(context) {
  const { api, threadID, messageID, args } = context;
  
  if (args.length < 2) {
    await api.sendMessage("⚠️ Sử dụng: load <c|e|f> <filename> hoặc load <c|e> all", threadID, messageID);
    return;
  }
  
  const type = args[0].toLowerCase();
  const fileName = args[1];
  const projectRoot = join(__dirname, '..', '..', '..');
  const cmdsDir = join(process.cwd(), 'core', 'plugins', 'cmds');
  const eventsDir = join(process.cwd(), 'core', 'plugins', 'events');
  
  let filePath = null;
  
  if (type === 'c') {
    if (fileName === 'all' || fileName === 'a') {
      const allJsFiles = getAllJsFiles(cmdsDir);
      let loadedCount = 0;
      let failedCount = 0;
      
      for (const file of allJsFiles) {
        try {
          const fileUrl = 'file://' + file;
          const plugin = await import(fileUrl + '?t=' + Date.now());
          
          if (plugin.config && plugin.call) {
            const commandName = plugin.config.name || path.basename(file, '.js');
            const { folder } = getRelativePath(file, cmdsDir);
            
            if (global.client.commands.has(commandName)) {
              global.client.commands.delete(commandName);
            }
            
            global.client.commands.set(commandName, {
              config: {
                ...plugin.config,
                category: plugin.config.category || folder,
                filePath: path.relative(cmdsDir, file)
              },
              call: plugin.call,
              onReply: plugin.onReply,
              onReaction: plugin.onReaction
            });
            
            loadedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
          console.error(`Lỗi khi tải file ${file}:`, err);
        }
      }
      
      await api.sendMessage(`✅ Loaded ${loadedCount} commands\n❌ Failed: ${failedCount}`, threadID, messageID);
    } else {
      filePath = findFileInCommands(cmdsDir, fileName);
      
      if (!filePath) {
        await api.sendMessage("❌ Không tìm thấy command: " + fileName, threadID, messageID);
        return;
      }
      
      const oldCommandName = fileName;
      if (global.client.commands.has(oldCommandName)) {
        global.client.commands.delete(oldCommandName);
      }
      
      for (const [name, cmd] of global.client.commands) {
        if (cmd.config.alias && cmd.config.alias.includes(fileName)) {
          global.client.commands.delete(name);
          break;
        }
      }
      
      try {
        const fileUrl = 'file://' + filePath;
        const plugin = await import(fileUrl + '?t=' + Date.now());
        
        if (plugin.config && plugin.call) {
          const commandName = plugin.config.name || path.basename(fileName);
          const { folder } = getRelativePath(filePath, cmdsDir);
          
          global.client.commands.set(commandName, {
            config: {
              ...plugin.config,
              category: plugin.config.category || folder,
              filePath: path.relative(cmdsDir, filePath)
            },
            call: plugin.call,
            onReply: plugin.onReply,
            onReaction: plugin.onReaction
          });
          
          await api.sendMessage(`✅ Loaded command: ${commandName}${folder ? ` [${folder}]` : ''}`, threadID, messageID);
        } else {
          await api.sendMessage("❌ Lệnh cần tải không đúng định dạng!", threadID, messageID);
        }
      } catch (err) {
        await api.sendMessage(`❌ Lỗi khi tải command: ${err.message}`, threadID, messageID);
        console.error(err);
      }
    }
  } 
  else if (type === 'e') {
    if (fileName === 'all' || fileName === 'a') {
      const allJsFiles = getAllJsFiles(eventsDir);
      let loadedCount = 0;
      let failedCount = 0;
      
      for (const file of allJsFiles) {
        try {
          const fileUrl = 'file://' + file;
          const plugin = await import(fileUrl + '?t=' + Date.now());
          
          if (plugin.config && plugin.config.eventType) {
            const eventName = plugin.config.name || path.basename(file, '.js');
            
            if (global.client.events.has(eventName)) {
              global.client.events.delete(eventName);
            }
            
            global.client.events.set(eventName, {
              config: plugin.config,
              call: plugin.call
            });
            
            loadedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
          console.error(`Lỗi khi tải fil ${file}:`, err);
        }
      }
      
      await api.sendMessage(`✅ Loaded ${loadedCount} events\n❌ Failed: ${failedCount}`, threadID, messageID);
    } else {
      filePath = join(process.cwd(), 'core', 'plugins', 'events', fileName + '.js');
      
      if (!fs.existsSync(filePath)) {
        await api.sendMessage("❌ Không tìm thấy event: " + fileName, threadID, messageID);
        return;
      }
      
      const fileUrl = 'file://' + filePath;
      
      const plugin = await import(fileUrl + '?t=' + Date.now());
      
      if (plugin.config && plugin.config.eventType) {
        global.client.events.set(plugin.config.name || fileName, {
          config: plugin.config,
          call: plugin.call
        });
        await api.sendMessage("✅ Loaded event: " + (plugin.config.name || fileName), threadID, messageID);
      }
    }
  }
  else if (type === 'f') {
    filePath = findFileInCommands(projectRoot, fileName);
    
    if (!filePath) {
      await api.sendMessage("❌ Không tìm thấy file: " + fileName, threadID, messageID);
      return;
    }
    
    const fileUrl = 'file://' + filePath;
    await import(fileUrl + '?t=' + Date.now());
    await api.sendMessage("✅ Loaded file: " + fileName + ".js at " + path.relative(projectRoot, filePath), threadID, messageID);
  }
  else {
    await api.sendMessage("⚠️ Dùng load c (command), e (event), f (file)", threadID);
  }
}