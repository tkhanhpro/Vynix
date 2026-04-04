import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tempDir = path.join(__dirname, '../../storage/temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

export function parseCookies(cookies) {
    const trimmed = cookies.includes('useragent=') ? cookies.split('useragent=')[0] : cookies;
    const now = new Date().toISOString();
    
    return trimmed.split(';').map(pair => {
        let [key, value] = pair.trim().split('=');
        if (value !== undefined) {
            return { key, value, domain: "facebook.com", path: "/", hostOnly: false, creation: now, lastAccessed: now };
        }
    }).filter(item => item);
}

export async function streamURL(url, type) {
    return axios.get(url, {
        responseType: "stream",
        timeout: 15000
    }).then(res => {

        const tempFile = path.resolve(tempDir, `${Date.now()}.${type}`);
        const writeStream = fs.createWriteStream(tempFile);

        res.data.pipe(writeStream);

        return new Promise((resolve, reject) => {

            writeStream.on("finish", () => {

                const readStream = fs.createReadStream(tempFile);

                readStream.on("close", () => {
                    if (fs.existsSync(tempFile))
                        fs.unlinkSync(tempFile);
                });

                resolve(readStream);
            });

            writeStream.on("error", reject);

        });

    });
}