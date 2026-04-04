import cron from 'node-cron';
import axios from 'axios';
import { readFileSync } from 'fs';

const JSON_FILES = {
  vdgai: './storage/media/json/vdgai.json',
  vdtrai: './storage/media/json/vdtrai.json',
  vdanime: './storage/media/json/vdanime.json',
  vdcos: './storage/media/json/vdcosplay.json',
  vdmiku: './storage/media/json/nakanomiku.json'
};

const MAX_ITEMS = 15;
const MAX_UPLOAD_PER_TICK = 5;
const CRON_SCHEDULE = '*/5 * * * * *';
const UPLOAD_URL = 'https://www.facebook.com/ajax/mercury/upload.php';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function initGlobalArray(key) {
  if (!Array.isArray(global[key])) {
    global[key] = [];
  }
  return global[key];
}

async function streamUrl(url) {
  const response = await axios({
    url,
    responseType: 'stream'
  });
  return response.data;
}

async function upload(url) {
  const response = await global.api.postFormData(UPLOAD_URL, {
    upload_1024: await streamUrl(url),
    voice_clip: 'true'
  });

  const meta = response?.payload?.metadata?.[0];
  if (!meta || typeof meta !== 'object') return null;

  const entry = Object.entries(meta).find(
    ([key, value]) =>
      /_id$/.test(key) &&
      (typeof value === 'string' || typeof value === 'number')
  );

  return entry || null;
}

function createCategories() {
  return Object.entries(JSON_FILES).map(([name, filePath]) => ({
    name,
    data: initGlobalArray(name),
    path: readJson(filePath)
  }));
}

function getRandomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function fillCategory(category) {
  if (category.data.length >= MAX_ITEMS) return;

  const itemsNeeded = Math.min(MAX_ITEMS - category.data.length, MAX_UPLOAD_PER_TICK);

  const uploadPromises = Array.from({ length: itemsNeeded }, () =>
    upload(getRandomItem(category.path))
  );

  const settled = await Promise.allSettled(uploadPromises);

  const successItems = settled
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => result.value);

  if (successItems.length > 0) {
    global.logger.info(
      `Uploaded successfully ${successItems.length} item(s) for ${category.name}`
    );
    category.data.push(...successItems);
  }
}

function upLoad() {
  const categories = createCategories();
  let isRunning = false;

  cron.schedule(CRON_SCHEDULE, async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      for (const category of categories) {
        await fillCategory(category);
      }
    } finally {
      isRunning = false;
    }
  });
}

export default upLoad;