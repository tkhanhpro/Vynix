import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import Youtube from 'youtube-search-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  name: "sing",
  alias: ["music", "song"],
  role: 0,
  info: "Phát nhạc từ YouTube",
  guide: "sing <tên bài hát hoặc link YouTube>",
  cd: 2,
  prefix: false
};

async function downloadMusicFromYoutube(link) {
  const timestart = Date.now();

  if (!link) {
    return 'Thiếu link';
  }

  try {
    const apiResponse = await axios.post('https://app.ytdown.to/proxy.php', {
      url: link
    }, {
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://app.ytdown.to',
        'Referer': 'https://app.ytdown.to/vi21/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const data = apiResponse.data;

    if (!data || !data.api || data.api.status !== 'ok') {
      throw new Error(data.api?.message || 'Không tìm thấy thông tin video');
    }

    const apiData = data.api;

    const audioItems = apiData.mediaItems.filter(item => item.type === 'Audio');

    if (audioItems.length === 0) {
      throw new Error('Không tìm thấy audio để tải');
    }

    let selectedAudio = null;

    selectedAudio = audioItems.find(item =>
      item.mediaExtension === 'MP3' && item.mediaQuality === '48K'
    );

    if (!selectedAudio) {
      selectedAudio = audioItems.find(item =>
        item.mediaExtension === 'M4A' && item.mediaQuality === '48K'
      );
    }

    if (!selectedAudio) {
      const qualityOrder = ['128K', '48K'];
      for (const quality of qualityOrder) {
        selectedAudio = audioItems.find(item => item.mediaQuality === quality);
        if (selectedAudio) break;
      }
    }

    if (!selectedAudio) {
      selectedAudio = audioItems[0];
    }

    const audioUrl = selectedAudio.mediaPreviewUrl || selectedAudio.mediaUrl;
    const audioExtension = selectedAudio.mediaExtension.toLowerCase();

    if (!audioUrl) {
      throw new Error('Không có URL tải audio');
    }

    const audioStream = await global.tools.streamURL(audioUrl, audioExtension);

    if (!audioStream) {
      throw new Error('Không thể tải audio');
    }

    return {
      title: apiData.title || 'Không rõ',
      duration: apiData.mediaItems[0]?.mediaDuration || '0:00',
      sub: apiData.userInfo?.followersCount || 0,
      viewCount: apiData.mediaStats?.viewsCount || 0,
      author: apiData.userInfo?.name || 'Không rõ',
      timestart,
      audioStream: audioStream,
      audioExtension: audioExtension
    };

  } catch (err) {
    console.error('Lỗi khi tải nhạc:', err.message);
    throw err;
  }
}

function getVideoIdFromUrl(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export async function call(context) {
  const { api, event, args, senderID, threadID, messageID, reply, send } = context;

  const userData = global.data.userData.get(senderID);
  const userName = userData?.name || "Người dùng Facebook";

  if (args.length === 0 || !args.join("")) {
    await reply('⚠️ Vui lòng cung cấp tên bài hát hoặc link YouTube!');
    return;
  }

  const keywordSearch = args.join(" ");
  const tempDir = path.join(__dirname, '..', '..', '..', '..', 'storage', 'temp');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const audioPath = path.join(tempDir, `music-${senderID}.mp3`);

  if (fs.existsSync(audioPath)) {
    try {
      fs.unlinkSync(audioPath);
    } catch (e) {
      console.error('Xóa file cũ thất bại:', e.message);
    }
  }

  if (keywordSearch.includes("youtube.com") || keywordSearch.includes("youtu.be")) {
    try {
      const videoId = getVideoIdFromUrl(keywordSearch);
      if (!videoId) {
        await reply('⚠️ Link YouTube không hợp lệ!');
        return;
      }

      const result = await downloadMusicFromYoutube(keywordSearch);
      if (typeof result === 'string') {
        await reply(result);
        return;
      }

      try {
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const stream = await global.tools.streamURL(thumbnailUrl, 'jpg');
        if (stream) {
          await reply({
            body: `🎧 Tên bài: ${result.title}\n` +
              `⏱️ Thời lượng: ${result.duration}\n` +
              `🌐 Tác giả: ${result.author}\n` +
              `👥 Lượt theo dõi: ${result.sub}\n` +
              `👁️ Lượt xem: ${result.viewCount}\n` +
              `👤 Yêu cầu: ${userName}\n`,
            attachment: stream
          });
          return;
        }
      } catch (thumbnailErr) {
        console.error('Lỗi khi tải thumbnail:', thumbnailErr.message);
      }

      await api.setMessageReaction("✅", messageID, threadID);
      await send({
        attachment: result.audioStream,
      });
      return;

    } catch (e) {
      console.error('Lỗi khi tải từ link:', e.message);
      await reply('⚠️ Đã xảy ra lỗi khi tải nhạc từ link!');
      return;
    }
  }

  try {
    await api.setMessageReaction("⌛", messageID, threadID);

    const data = (await Youtube.GetListByKeyword(keywordSearch, false, 10)).items;
    if (!data || data.length === 0) {
      await api.setMessageReaction("❎", messageID, threadID);
      await reply('❌ Không tìm thấy kết quả nào!');
      return;
    }

    let videos = [];
    let msg = "";
    let num = 0;

    for (let value of data) {
      if (value.id) {
        let videoId;

        if (typeof value.id === 'object' && value.id.videoId) {
          videoId = value.id.videoId;
        } else if (typeof value.id === 'string') {
          if (value.id.includes('youtube.com') || value.id.includes('youtu.be')) {
            const extractedId = getVideoIdFromUrl(value.id);
            videoId = extractedId || value.id;
          } else if (value.id.length === 11) {
            videoId = value.id;
          } else {
            videoId = value.id;
          }
        } else {
          videoId = value.id;
        }

        videos.push({
          videoId: videoId,
          title: value.title,
          channelTitle: value.channelTitle || 'Không rõ',
          length: value.length?.simpleText || 'N/A',
          originalId: value.id
        });
        num++;
        msg += `${num} – ${value.title}\n` +
               `📺 Tên kênh: ${value.channelTitle || 'Không rõ'}\n` +
               `⏱️ Thời lượng: ${value.length?.simpleText || 'N/A'}\n` +
               `──────────────────\n`;
      }
    }

    const body = `[ Kết Quả Tìm Kiếm ]\n──────────────────\n${msg}` + `📌 Reply tin nhắn này kèm số thứ tự bài hát bạn chọn nhé ${userName}`;

    await api.setMessageReaction("✅", messageID, threadID);

    const replyMsg = await reply(body, threadID, messageID);

    global.client.onReply.push({
      author: senderID,
      messageID: replyMsg.messageID,
      callback: async (ctx) => {
        await onReply(ctx, videos, replyMsg.messageID);
      },
      data: { videos }
    });

  } catch (e) {
    console.error(e.stack);
    await api.setMessageReaction("❎", messageID, threadID);
    await reply('Lỗi khi tìm kiếm trên YouTube!');
    return;
  }
}

async function onReply(context, videos, listMessageId) {
  const { api, event, body, threadID, messageID, senderID, reply, send } = context;

  const choice = parseInt(body.trim());
  if (isNaN(choice) || choice < 1 || choice > videos.length) {
    await reply('Vui lòng nhập số hợp lệ!');
    return;
  }

  await api.setMessageReaction("⌛", messageID, threadID);

  const selectedVideo = videos[choice - 1];
  const url = `https://www.youtube.com/watch?v=${selectedVideo.videoId}`;

  try {
    const result = await downloadMusicFromYoutube(url);

    try {
      const thumbnailUrl = `https://img.youtube.com/vi/${selectedVideo.videoId}/maxresdefault.jpg`;
      const stream = await global.tools.streamURL(thumbnailUrl, 'jpg');
      if (stream) {
        await reply({
          body: `🎵 Tên bài: ${result.title}\n` +
            `⏰ Thời lượng: ${result.duration}\n` +
            `🌐 Tác giả: ${result.author}\n`,
          attachment: stream
        });
        return;
      }
    } catch (thumbnailErr) {
      console.error('Lỗi thumbnail:', thumbnailErr.message);
    }

    if (listMessageId) {
      try {
        api.unsendMessage(listMessageId);
      } catch (err) {
        console.error('Không thể thu hồi tin nhắn list:', err.message);
      }
    }

    try {
      await api.unsendMessage(messageID);
    } catch (err) {
      console.error('Không thể thu hồi tin nhắn người dùng:', err.message);
    }

    await api.setMessageReaction("✅", messageID, threadID);
    await send({
      attachment: result.audioStream,
    });
    return;

  } catch (e) {
    console.error(e.stack);
    await reply('Đã xảy ra lỗi khi tải nhạc!');
    return;
  }
}