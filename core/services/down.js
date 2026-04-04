import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import crypto from 'crypto';

const BASE_URL = 'https://j2download.com';

const jar = new CookieJar();
const client = wrapper(axios.create({
    baseURL: BASE_URL,
    jar,
    withCredentials: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/`
    }
}));

let cachedToken = null;
let tokenExpiry = 0;

function hasLeadingZeroNibbles(hash, difficulty) {
    const fullBytes = Math.floor(difficulty / 2);
    const hasHalfByte = (difficulty % 2) === 1;
    for (let i = 0; i < fullBytes; i++) if (hash[i] !== 0) return false;
    if (hasHalfByte && (hash[fullBytes] & 0xF0) !== 0) return false;
    return true;
}

async function findSolution(challenge, difficulty) {
    const prefix = `j2pow:v2:${challenge}:`;
    const prefixBuffer = Buffer.from(prefix, 'utf8');
    for (let n = 0; n < 100_000_000; n++) {
        const nStr = n.toString();
        const fullBuffer = Buffer.concat([prefixBuffer, Buffer.from(nStr, 'utf8')]);
        const hash = crypto.createHash('sha256').update(fullBuffer).digest();
        if (hasLeadingZeroNibbles(hash, difficulty)) return nStr;
    }
    return null;
}

async function getAccessToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) return cachedToken;

    try {
        await client.get('/');
    } catch (e) {}

    let bootstrap;
    try {
        const res = await client.get('/api/auth/bootstrap');
        bootstrap = res.data;
    } catch (error) {
        if (error.response?.data?.error === 'session_required') {
            const recover = await client.post('/api/auth/recover');
            if (!recover.data.ok) throw new Error('Recover failed');
            bootstrap = recover.data;
        } else {
            throw error;
        }
    }

    let solution = null;
    if (bootstrap.powChallenge && bootstrap.powDifficulty > 0) {
        solution = await findSolution(bootstrap.powChallenge, bootstrap.powDifficulty);
        if (!solution) throw new Error('PoW solution not found');
    }

    const headers = { 'X-Page-Nonce': bootstrap.nonce };
    if (solution) headers['X-Pow-Solution'] = solution;

    const issue = await client.post('/api/auth/issue', {}, { headers });
    const { accessToken, expiresIn } = issue.data;
    if (!accessToken) throw new Error('No access token');

    cachedToken = accessToken;
    tokenExpiry = Date.now() + (expiresIn * 1000);
    return accessToken;
}

async function down(url) {
    const token = await getAccessToken();
    const response = await client.post('/api/autolink', {
        data: { url, unlock: true }
    }, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
}
export default down;