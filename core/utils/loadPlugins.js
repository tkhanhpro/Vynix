import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getAllJsFiles(dir, baseDir = dir) {
  let jsFiles = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        jsFiles = jsFiles.concat(getAllJsFiles(itemPath, baseDir));
      } else if (stat.isFile() && item.endsWith('.js') && !item.startsWith('_')) {
        const relativePath = path.relative(baseDir, itemPath);
        jsFiles.push({
          fullPath: itemPath,
          relativePath: relativePath,
          fileName: item,
          folder: path.dirname(relativePath) === '.' ? null : path.dirname(relativePath)
        });
      }
    }
  } catch (err) {
    logger.error(`Error reading directory ${dir}:`, err);
  }
  
  return jsFiles;
}

async function loadPlugins() {
  const baseDir = path.join(__dirname, '..', 'plugins');
  const cmdsDir = path.join(baseDir, 'cmds');
  const eventsDir = path.join(baseDir, 'events');

  if (fs.existsSync(cmdsDir)) {
    const cmdFiles = getAllJsFiles(cmdsDir);
    
    for (const file of cmdFiles) {
      try {
        const plugin = await import(`file://${file.fullPath}`);
        
        if (plugin.config && plugin.call) {
          const commandName = plugin.config.name || path.basename(file.fileName, '.js');
          
          global.client.commands.set(commandName, {
            config: {
              ...plugin.config,
              category: file.folder,
              filePath: file.relativePath
            },
            call: plugin.call,
            onReply: plugin.onReply,
            onReaction: plugin.onReaction
          });
          
          logger.success(`Loaded command: ${commandName}${file.folder ? ` [${file.folder}]` : ''}`);
        } else {
          logger.warn(`Invalid command: ${file.relativePath}`);
        }
      } catch (err) {
        logger.error(`Failed to load command ${file.relativePath}:`, err);
      }
    }
  } else {
    logger.warn(`Commands directory not found: ${cmdsDir}`);
  }

  if (fs.existsSync(eventsDir)) {
    const eventFiles = getAllJsFiles(eventsDir);
    
    for (const file of eventFiles) {
      try {
        const plugin = await import(`file://${file.fullPath}`);
        
        if (plugin.config && plugin.call) {
          const name = plugin.config.name || path.basename(file.fileName, '.js');
          
          global.client.events.set(name, {
            config: plugin.config,
            call: plugin.call
          });
          
          logger.success(`Loaded event: ${name}${file.folder ? ` [${file.folder}]` : ''}`);
        } else {
          logger.warn(`Invalid event: ${file.relativePath}`);
        }
      } catch (err) {
        logger.error(`Failed to load event ${file.relativePath}:`, err);
      }
    }
  } else {
    logger.warn(`Events directory not found: ${eventsDir}`);
  }

  logger.info(`Tải thành công ${global.client.commands.size} lệnh và ${global.client.events.size} events`
  );
}

export default loadPlugins;