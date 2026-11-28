import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import logger from '@kurisu/core/utils/logger';
import { AI_CONFIG } from './chat.js';

const execFileAsync = promisify(execFile);

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_BIN || 'ffprobe';
const STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

/**
 * A video failed before it could be turned into model input.
 */
export class VideoError extends Error {
  /**
   * @param {'too_long' | 'failed'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'VideoError';
    this.code = code;
  }
}

/**
 * Read duration and stream kinds from a video file.
 *
 * @param {string} file
 * @returns {Promise<{ duration: number, hasAudio: boolean }>}
 */
export const probeVideo = async (file) => {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      FFPROBE_BIN,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=codec_type',
        '-of',
        'json',
        file,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024 }
    ));
  } catch (err) {
    throw new VideoError('failed', `ffprobe failed: ${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(stdout || '{}');
  } catch {
    throw new VideoError('failed', 'ffprobe returned invalid JSON');
  }

  /** @type {Array<{ codec_type?: string }>} */
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const hasVideo = streams.some((stream) => stream.codec_type === 'video');
  const duration = Number.parseFloat(data.format?.duration);

  if (!hasVideo || !Number.isFinite(duration) || duration <= 0) {
    throw new VideoError('failed', 'video stream or duration is missing');
  }

  return {
    duration,
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  };
};

/**
 * Pick a frame count that scales with duration but stays cheap.
 *
 * @param {number} duration
 * @returns {number}
 */
export const planFrameCount = (duration) =>
  Math.min(
    AI_CONFIG.MAX_VIDEO_FRAMES,
    Math.max(
      AI_CONFIG.MIN_VIDEO_FRAMES,
      Math.ceil(duration / AI_CONFIG.VIDEO_FRAME_INTERVAL_SECONDS)
    )
  );

/**
 * Extract evenly spaced JPEG frames and return them as data URLs.
 *
 * @param {string} file
 * @param {string} dir
 * @param {{ duration: number, frameCount: number }} options
 * @returns {Promise<Array<{ dataUrl: string, timestamp: number }>>}
 */
export const extractVideoFrames = async (
  file,
  dir,
  { duration, frameCount }
) => {
  const interval = duration / frameCount;
  const start = 0;
  const scale = `scale=min(${AI_CONFIG.VIDEO_FRAME_MAX_WIDTH}\\,iw):-2`;

  try {
    await execFileAsync(
      FFMPEG_BIN,
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        file,
        '-an',
        '-vf',
        `fps=${(1 / interval).toFixed(6)},${scale}`,
        '-frames:v',
        String(frameCount),
        '-q:v',
        String(AI_CONFIG.VIDEO_FRAME_QUALITY),
        path.join(dir, 'frame-%02d.jpg'),
      ],
      { timeout: 60000, maxBuffer: 1024 * 1024 }
    );
  } catch (err) {
    throw new VideoError('failed', `frame extraction failed: ${err.message}`);
  }

  const files = (await fs.readdir(dir))
    .filter((name) => name.endsWith('.jpg'))
    .sort();

  if (files.length === 0) {
    throw new VideoError('failed', 'frame extraction produced no frames');
  }

  return Promise.all(
    files.map(async (name, index) => ({
      dataUrl: `data:image/jpeg;base64,${(
        await fs.readFile(path.join(dir, name))
      ).toString('base64')}`,
      timestamp: Math.min(duration, start + index * interval),
    }))
  );
};

/**
 * Extract a small mono audio track for speech-to-text.
 *
 * @param {string} file
 * @param {string} target
 * @returns {Promise<string | null>}
 */
export const extractVideoAudio = async (file, target) => {
  try {
    await execFileAsync(
      FFMPEG_BIN,
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        file,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        target,
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 }
    );
  } catch (err) {
    logger.debug('[AI_VIDEO]', `Audio extraction failed: ${err.message}`);
    return null;
  }

  const stat = await fs.stat(target).catch(() => null);
  return stat && stat.size > 0 ? target : null;
};

/**
 * Transcribe an audio file with ElevenLabs Scribe.
 *
 * @param {string} file
 * @returns {Promise<string>}
 */
export const transcribeAudio = async (file) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return '';

  const buffer = await fs.readFile(file);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'audio/mpeg' }), 'audio.mp3');
  form.append(
    'model_id',
    process.env.ELEVENLABS_STT_MODEL || 'scribe_v1'
  );

  const response = await fetch(STT_URL, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `ElevenLabs STT HTTP ${response.status}: ${detail.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return String(data.text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, AI_CONFIG.VIDEO_TRANSCRIPT_MAX_CHARS);
};

/**
 * Turn a downloaded video into frames plus an optional transcript.
 *
 * @param {Buffer | Uint8Array} bytes
 * @returns {Promise<{ duration: number, frames: Array<{ dataUrl: string, timestamp: number }>, transcript: string }>}
 */
export const prepareVideo = async (bytes) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurisu-video-'));
  const input = path.join(dir, 'input');
  const framesDir = path.join(dir, 'frames');

  try {
    await fs.writeFile(input, bytes);
    await fs.mkdir(framesDir);

    const { duration, hasAudio } = await probeVideo(input);
    if (duration > AI_CONFIG.MAX_VIDEO_SECONDS) {
      throw new VideoError(
        'too_long',
        `video is ${duration.toFixed(1)}s, limit is ${AI_CONFIG.MAX_VIDEO_SECONDS}s`
      );
    }

    const frames = await extractVideoFrames(input, framesDir, {
      duration,
      frameCount: planFrameCount(duration),
    });

    let transcript = '';
    if (hasAudio) {
      const audio = await extractVideoAudio(input, path.join(dir, 'audio.mp3'));
      if (audio) {
        try {
          transcript = await transcribeAudio(audio);
        } catch (err) {
          logger.warn('[AI_VIDEO]', `Transcription failed: ${err.message}`);
        }
      }
    }

    return { duration, frames, transcript };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

export default {
  VideoError,
  probeVideo,
  planFrameCount,
  extractVideoFrames,
  extractVideoAudio,
  transcribeAudio,
  prepareVideo,
};
