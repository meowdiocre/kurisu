import { delay } from '@kurisu/core/utils/common';
import logger from '@kurisu/core/utils/logger';

const API_URL = 'https://www.tikwm.com/api/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const MAX_BYTES = 95 * 1024 * 1024;
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;

const MIME_TYPES = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const isTikTokUrl = (value) => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === 'tiktok.com' ||
      host === 'www.tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'vt.tiktok.com' ||
      host === 'vm.tiktok.com'
    );
  } catch {
    return false;
  }
};

const waitForRateLimit = async () => {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await delay(MIN_INTERVAL_MS - elapsed);
  }
  lastRequestAt = Date.now();
};

const slugify = (value, fallback = 'tiktok') => {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return slug || fallback;
};

const inferMime = (url, fallback = 'application/octet-stream') => {
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
    return MIME_TYPES[ext] || fallback;
  } catch {
    return fallback;
  }
};

/**
 * TikTok fallback via the public tikwm API.
 * Handles video, audio, and photo posts (first image only).
 *
 * @param {string} url
 * @param {{ type?: 'video' | 'audio' | 'image', quality?: string }} [options]
 * @returns {Promise<{ type: string, quality: string, format: string, downloadUrl: string, mime: string, filename: string, buffer: Buffer }>}
 */
export async function downloadTikTok(url, options = {}) {
  const type = options.type || 'video';
  await waitForRateLimit();

  const response = await fetch(
    `${API_URL}?url=${encodeURIComponent(url)}`,
    {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!response.ok) {
    throw new Error(`TikTok API HTTP ${response.status}`);
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.code !== 0 || !payload.data) {
    throw new Error(payload?.msg || 'TikTok API returned no data');
  }

  const data = payload.data;
  const images = Array.isArray(data.images) ? data.images : [];
  let mediaUrl = '';
  let kind = type;

  if (type === 'audio') {
    mediaUrl = data.music || data.play || '';
    kind = 'audio';
  } else if (type === 'image') {
    mediaUrl = images[0] || data.play || '';
    kind = images.length > 0 ? 'image' : 'video';
  } else {
    mediaUrl = data.play || data.wmplay || images[0] || '';
    kind = images.length > 0 && !data.play ? 'image' : 'video';
  }

  if (!mediaUrl) {
    throw new Error('TikTok API returned no downloadable media');
  }
  if (mediaUrl.startsWith('/')) {
    mediaUrl = `https://www.tikwm.com${mediaUrl}`;
  }

  const mediaResponse = await fetch(mediaUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(120000),
  });
  if (!mediaResponse.ok) {
    throw new Error(`TikTok media HTTP ${mediaResponse.status}`);
  }

  const buffer = Buffer.from(await mediaResponse.arrayBuffer());
  if (!buffer.length) {
    throw new Error('TikTok media download returned an empty file');
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error('TikTok media is larger than 95 MB');
  }

  const contentType = mediaResponse.headers.get('content-type') || '';
  const mime = contentType.startsWith('image/') ||
    contentType.startsWith('audio/') ||
    contentType.startsWith('video/')
    ? contentType.split(';')[0]
    : inferMime(mediaUrl);

  const format =
    Object.entries(MIME_TYPES).find(([, value]) => value === mime)?.[0] ||
    (kind === 'audio' ? 'mp3' : kind === 'image' ? 'jpg' : 'mp4');

  return {
    type: kind,
    quality: kind === 'audio' ? 'audio' : 'original',
    format,
    downloadUrl: mediaUrl,
    mime,
    filename: `${slugify(data.title, 'tiktok')}.${format}`,
    buffer,
  };
}

export default { isTikTokUrl, downloadTikTok };
