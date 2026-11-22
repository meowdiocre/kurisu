import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import cache, { hashKey } from '@kurisu/core/services/cache';
import logger from '@kurisu/core/utils/logger';

const execFileAsync = promisify(execFile);

export const TTS_VOICE = process.env.TTS_VOICE || 'id-ID-GadisNeural';
export const TTS_MAX_CHARS = Number(process.env.TTS_MAX_CHARS || 400);

const EDGE_BIN = process.env.TTS_EDGE_BIN || '/opt/tts-venv/bin/edge-tts';

const cleanText = (text) =>
  String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_~`>#]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Synthesize text into an OGG/Opus voice note.
 * Returns null when TTS is unavailable; callers fall back to text.
 *
 * @param {string} text
 * @param {{ voice?: string, maxChars?: number }} [options]
 * @returns {Promise<{ buffer: Buffer, mimetype: string, seconds: number } | null>}
 */
export async function synthesizeVoice(text, options = {}) {
  const voice = options.voice || TTS_VOICE;
  const maxChars = Number(options.maxChars || TTS_MAX_CHARS);
  const input = cleanText(text).slice(0, maxChars);
  if (!input) return null;

  const cacheKey = `voice:${voice}:${hashKey(input)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurisu-tts-'));
  const mp3 = path.join(dir, 'speech.mp3');
  const ogg = path.join(dir, 'speech.ogg');

  try {
    await execFileAsync(
      EDGE_BIN,
      ['--voice', voice, '--text', input, '--write-media', mp3],
      { timeout: 30000 }
    );

    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        mp3,
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-ar',
        '48000',
        '-ac',
        '1',
        ogg,
      ],
      { timeout: 30000 }
    );

    const buffer = await fs.readFile(ogg);
    if (buffer.length === 0) return null;

    let seconds = 0;
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'csv=p=0',
          ogg,
        ],
        { timeout: 10000 }
      );
      seconds = Number.parseFloat(stdout) || 0;
    } catch {}

    const result = {
      buffer,
      mimetype: 'audio/ogg; codecs=opus',
      seconds: Math.max(1, Math.round(seconds)),
    };
    await cache.set(cacheKey, result, '1h');
    return result;
  } catch (err) {
    logger.warn('[TTS]', `Synthesis failed: ${err.message ?? err}`);
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Read the AI reply delivery mode.
 * off: text only, voice: voice note only, both: text then voice.
 *
 * @returns {'off' | 'voice' | 'both'}
 */
export function getVoiceReplyMode() {
  const raw = String(process.env.TTS_REPLY_MODE || 'off')
    .trim()
    .toLowerCase();
  if (raw === 'voice' || raw === 'both') return raw;
  return 'off';
}

export default {
  TTS_VOICE,
  TTS_MAX_CHARS,
  synthesizeVoice,
  getVoiceReplyMode,
};
