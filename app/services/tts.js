import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import cache, { hashKey } from '@kurisu/core/services/cache';
import logger from '@kurisu/core/utils/logger';

const execFileAsync = promisify(execFile);

export const TTS_PROVIDERS = ['edge', 'google', 'elevenlabs'];
export const TTS_VOICE = process.env.TTS_VOICE || 'id-ID-GadisNeural';
export const TTS_MAX_CHARS = Number(process.env.TTS_MAX_CHARS || 400);

const EDGE_BIN = process.env.TTS_EDGE_BIN || '/opt/tts-venv/bin/edge-tts';
const GOOGLE_LANG = process.env.TTS_GOOGLE_LANG || 'id';
const GOOGLE_CHUNK = 180;

const cleanText = (text) =>
  String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_~`>#]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const splitChunks = (text, max) => {
  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('. ', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
};

const fetchBuffer = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

const writeEdge = async (text, voice, target) => {
  await execFileAsync(
    EDGE_BIN,
    ['--voice', voice, '--text', text, '--write-media', target],
    { timeout: 30000 }
  );
};

const writeGoogle = async (text, dir, target) => {
  const chunks = splitChunks(text, GOOGLE_CHUNK);
  const files = [];

  for (let index = 0; index < chunks.length; index++) {
    const query = encodeURIComponent(chunks[index]);
    const url =
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
      `&tl=${GOOGLE_LANG}&q=${query}`;
    const buffer = await fetchBuffer(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });
    const file = path.join(dir, `google-${index}.mp3`);
    await fs.writeFile(file, buffer);
    files.push(file);
  }

  if (files.length === 1) {
    await fs.copyFile(files[0], target);
    return;
  }

  const list = path.join(dir, 'concat.txt');
  await fs.writeFile(
    list,
    files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n')
  );
  await execFileAsync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', target],
    { timeout: 30000 }
  );
};

const writeElevenLabs = async (text, voice, target) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');

  const voiceId =
    voice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}` +
    `?output_format=mp3_44100_128`;
  const buffer = await fetchBuffer(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });
  await fs.writeFile(target, buffer);
};

const toOgg = async (mp3, ogg) => {
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
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ogg],
      { timeout: 10000 }
    );
    seconds = Number.parseFloat(stdout) || 0;
  } catch {}

  return {
    buffer,
    mimetype: 'audio/ogg; codecs=opus',
    seconds: Math.max(1, Math.round(seconds)),
  };
};

const synthesizeWith = async (provider, text, voice) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurisu-tts-'));
  const mp3 = path.join(dir, 'speech.mp3');
  const ogg = path.join(dir, 'speech.ogg');

  try {
    if (provider === 'google') {
      await writeGoogle(text, dir, mp3);
    } else if (provider === 'elevenlabs') {
      await writeElevenLabs(text, voice, mp3);
    } else {
      await writeEdge(text, voice, mp3);
    }
    return await toOgg(mp3, ogg);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

/**
 * Synthesize text into an OGG/Opus voice note.
 * Falls back to edge-tts when the selected provider fails.
 *
 * @param {string} text
 * @param {{ provider?: string, voice?: string, maxChars?: number }} [options]
 * @returns {Promise<{ buffer: Buffer, mimetype: string, seconds: number, provider: string } | null>}
 */
export async function synthesizeVoice(text, options = {}) {
  const input = cleanText(text).slice(
    0,
    Number(options.maxChars || TTS_MAX_CHARS)
  );
  if (!input) return null;

  const requested = String(
    options.provider || process.env.TTS_PROVIDER || 'edge'
  ).toLowerCase();
  const voice = options.voice || TTS_VOICE;

  const order = [requested, 'edge'].filter(
    (provider, index, list) =>
      TTS_PROVIDERS.includes(provider) && list.indexOf(provider) === index
  );

  for (const provider of order) {
    const cacheKey = `voice:${provider}:${voice}:${hashKey(input)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await synthesizeWith(provider, input, voice);
      if (!result) continue;
      const payload = { ...result, provider };
      await cache.set(cacheKey, payload, '1h');
      return payload;
    } catch (err) {
      logger.warn(
        '[TTS]',
        `${provider} synthesis failed: ${err.message ?? err}`
      );
    }
  }

  return null;
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
  TTS_PROVIDERS,
  TTS_VOICE,
  TTS_MAX_CHARS,
  synthesizeVoice,
  getVoiceReplyMode,
};
