import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import logger from './core/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n
██╗░░░██╗██╗░░░██╗███╗░░██╗██╗██╗░░██╗
██║░░░██║╚██╗░██╔╝████╗░██║██║╚██╗██╔╝
╚██╗░██╔╝░╚████╔╝░██╔██╗██║██║░╚███╔╝░
░╚████╔╝░░░╚██╔╝░░██║╚████║██║░██╔██╗░
░░╚██╔╝░░░░░██║░░░██║░╚███║██║██╔╝╚██╗
░░░╚═╝░░░░░░╚═╝░░░╚═╝░░╚══╝╚═╝╚═╝░░╚═╝\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

logger(msg);
logger.info("Tiến hành khởi động...");

const botProcess = spawn('node', [join(__dirname, 'core', 'main.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

botProcess.on('error', (error) => {
  console.error('Failed to start bot process:', error);
});

botProcess.on('exit', (code) => {
  if (code !== 0) {
    logger.info(`Bot process exited with code ${code}`);
  }
});