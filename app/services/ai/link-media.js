import logger from '@kurisu/core/utils/logger';
import { downloadMedia } from '#app/services/downloader-media.js';
import { AI_CONFIG } from './chat.js';
import { prepareVideo, VideoError } from './video.js';

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

// Only fetch from platforms the downloader is expected to understand. This
// keeps arbitrary links (docs, dashboards, redirectors) out of the downloader.
const MEDIA_HOSTS = [
  'tiktok.com',
  'instagram.com',
  'instagr.am',
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'fb.watch',
  'twitter.com',
  'x.com',
  'threads.net',
  'threads.com',
  'snackvideo.com',
  'douyin.com',
  'capcut.com',
];

/**
 * Check whether a URL belongs to a supported media platform.
 *
 * @param {string} value
 * @returns {boolean}
 */
export const isSupportedMediaUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return MEDIA_HOSTS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
};

/**
 * Extract the first supported media URL from text.
 *
 * @param {string} text
 * @returns {string}
 */
export const extractMediaUrl = (text) => {
  const matches = String(text || '').match(URL_REGEX) || [];
  for (const raw of matches) {
    const url = raw.replace(/[)\].,!?]+$/, '');
    if (isSupportedMediaUrl(url)) return url;
  }
  return '';
};

/**
 * Download a supported link and turn it into model input.
 *
 * @param {string} url
 * @param {{ download?: typeof downloadMedia }} [options]
 * @returns {Promise<
 *   | { kind: 'video', duration: number, frames: Array<{ dataUrl: string, timestamp: number }>, transcript: string }
 *   | { kind: 'image', mime: string, dataUrl: string }
 *   | { error: 'unsupported' | 'too_large' | 'too_long' | 'failed' }
 * >}
 */
export const loadLinkedMedia = async (url, { download = downloadMedia } = {}) => {
  let media;
  try {
    media = await download(url, { type: 'video' });
  } catch (err) {
    logger.warn('[AI_LINK]', `Download failed for ${url}: ${err.message}`);
    return { error: 'failed' };
  }

  if (!media?.buffer?.length) {
    return { error: 'failed' };
  }

  if (media.type === 'image') {
    if (media.buffer.length > AI_CONFIG.MAX_IMAGE_BYTES) {
      return { error: 'too_large' };
    }
    const mime = String(media.mime || 'image/jpeg').toLowerCase();
    if (!AI_CONFIG.IMAGE_MIME_TYPES.includes(mime)) {
      return { error: 'unsupported' };
    }
    return {
      kind: 'image',
      mime,
      dataUrl: `data:${mime};base64,${media.buffer.toString('base64')}`,
    };
  }

  if (media.type !== 'video') {
    return { error: 'unsupported' };
  }

  if (media.buffer.length > AI_CONFIG.MAX_VIDEO_BYTES) {
    return { error: 'too_large' };
  }

  try {
    return { kind: 'video', ...(await prepareVideo(media.buffer)) };
  } catch (err) {
    if (err instanceof VideoError) {
      return { error: err.code };
    }
    logger.warn('[AI_LINK]', `Video preparation failed for ${url}: ${err.message}`);
    return { error: 'failed' };
  }
};

export default {
  isSupportedMediaUrl,
  extractMediaUrl,
  loadLinkedMedia,
};
