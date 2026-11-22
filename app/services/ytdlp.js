import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import logger from '@kurisu/core/utils/logger';

const execFileAsync = promisify(execFile);

const YTDLP_BIN = process.env.YTDLP_BIN || '/opt/ytdlp-venv/bin/yt-dlp';
const MAX_BYTES = 95 * 1024 * 1024;

const MIME_TYPES = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  opus: 'audio/ogg',
  ogg: 'audio/ogg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Fallback downloader for sources VidsSave cannot parse.
 * Requires yt-dlp on the host.
 *
 * @param {string} url
 * @param {{ type?: 'video' | 'audio' | 'image', quality?: string }} [options]
 * @returns {Promise<{ type: string, quality: string, format: string, downloadUrl: string, mime: string, filename: string, buffer: Buffer }>}
 */
export async function downloadWithYtDlp(url, options = {}) {
  const type = options.type || 'video';
  if (type === 'image') {
    throw new Error('yt-dlp fallback does not support image downloads');
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurisu-ytdlp-'));
  const template = path.join(dir, 'media.%(ext)s');
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--restrict-filenames',
    '--max-filesize',
    '95M',
    '-o',
    template,
  ];

  if (type === 'audio') {
    args.push('-x', '--audio-format', 'mp3', '-f', 'ba/b');
  } else {
    args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
  }

  const quality = String(options.quality || '').replace(/[^0-9]/g, '');
  if (quality) {
    args.push('-S', `res:${quality}`);
  }

  args.push(url);

  try {
    await execFileAsync(YTDLP_BIN, args, {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const files = (await fs.readdir(dir)).filter(
      (file) => !file.endsWith('.part') && !file.endsWith('.ytdl')
    );
    const file = files[0];
    if (!file) {
      throw new Error('yt-dlp produced no output file');
    }

    const fullPath = path.join(dir, file);
    const stats = await fs.stat(fullPath);
    if (stats.size === 0) {
      throw new Error('yt-dlp produced an empty file');
    }
    if (stats.size > MAX_BYTES) {
      throw new Error('Downloaded media is larger than 95 MB');
    }

    const buffer = await fs.readFile(fullPath);
    const format = path.extname(file).slice(1).toLowerCase() || 'bin';

    return {
      type,
      quality: quality ? `${quality}p` : type === 'audio' ? 'audio' : 'best',
      format,
      downloadUrl: url,
      mime: MIME_TYPES[format] || 'application/octet-stream',
      filename: file,
      buffer,
    };
  } catch (err) {
    logger.warn('[YTDLP]', `Fallback failed for ${url}: ${err.message ?? err}`);
    throw err;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export default { downloadWithYtDlp };
