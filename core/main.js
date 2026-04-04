import login from '@dongdev/fca-unofficial';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from './database/index.js';
import loadPlugins from './utils/loadPlugins.js';
import loadConfig from './utils/loadConfig.js';
import logger from './utils/logger.js';
import * as tools from './utils/tools.js';
import cleaner from './utils/cleaner.js';
import loadServices from './utils/loadServices.js';
import upLoad from './utils/upLoad.js';
import Listener from './helpers/listener.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

global.client = {
  commands: new Map(),
  events: new Map(),
  onReply: [],
  onReaction: [],
  startTime: Date.now(),
};
global.config = loadConfig();
global.data = {
  threadData: new Map(),
  userData: new Map(),
  currencyData: new Map(),
  threadBanned: new Map(),
  userBanned: new Map(),
  commandBanned: new Map(),
  allThreadID: new Map(),
};
global.acc = {
  cookie: {},
  token: {}
};
global.tools = tools;
global.logger = logger;

try {
  const cookiePath = join(__dirname, '..', 'storage', 'bot', 'cookie.txt');
  if (fs.existsSync(cookiePath)) {
    const cookieContent = fs.readFileSync(cookiePath, 'utf8');
    const cookieLines = cookieContent.split(';');
    cookieLines.forEach(line => {
      const [key, value] = line.trim().split('=');
      if (key && value) global.acc.cookie[key.trim()] = value.trim();
    });
  }
} catch (error) {
  global.acc.cookie = {};
}

try {
  const tokenPath = join(__dirname, '..', 'storage', 'bot', 'tokens.json');
  if (fs.existsSync(tokenPath)) {
    global.acc.token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  }
} catch (error) {
  global.acc.token = {};
}

const appPath = join(__dirname, '..', 'storage', 'bot', 'app.json');
let appState = {};

try {
  if (fs.existsSync(appPath)) {
    appState = JSON.parse(fs.readFileSync(appPath, 'utf8'));
  }
} catch (error) {
  logger.error('Lỗi khi tải file appState');
  process.exit(1);
}

global.database = new Database();
await global.database.init();
logger.info("Khởi tạo database thành công");
logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

await loadPlugins();
setTimeout(async () => {
  await upLoad();
}, 7500);
await loadServices();
await cleaner();

logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const listener = new Listener();

logger.info("Tiến hành đăng nhập...");

login({ appState: appState }, (error, api) => {
  if (error) {
    logger.error('Lỗi khi đăng nhập:', error);
    process.exit(1);
  }
  
  global.api = api;
    global.api.setOptions(global.config.options);
  listener.listen(api);
  setTimeout(() => {
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }, 2650);
});