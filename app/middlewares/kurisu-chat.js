import cache from '@kurisu/core/services/cache';
import { RateLimiter } from '@kurisu/core/utils/rate-limiter';
import logger from '@kurisu/core/utils/logger';
import { delay } from '@kurisu/core/utils/common';
import { resolveMediaPayload } from 'zapo-js';
import { createChatCompletion } from '#app/services/ai/client.js';
import {
  AI_CONFIG,
  buildChatPayload,
  appendChatHistory,
  sanitizeAiResponse,
} from '#app/services/ai/chat.js';
import { getSkillDefinitions, executeSkill } from '#app/skills/index.js';
import { extractMentionsFromText } from '#app/services/bot/index.js';
import { resolvePersonaModesWithClient } from '#app/services/ai/persona-mode.js';
import {
  getVoiceReplyMode,
  synthesizeVoice,
  wantsVoiceReply,
} from '#app/services/tts.js';
import { prepareVideo, VideoError } from '#app/services/ai/video.js';
import { extractMediaUrl, loadLinkedMedia } from '#app/services/ai/link-media.js';

/**
 * Generate a random integer between min and max inclusive
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const randomDelay = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Check whether the AI explicitly decided not to reply.
 *
 * @param {string} text
 * @returns {boolean}
 */
const isNoReply = (text) =>
  String(text || '')
    .trim()
    .toUpperCase() === AI_CONFIG.NO_REPLY_TOKEN;

const aiRateLimiter = new RateLimiter(cache);
const activeAiRequests = new Set();
const IMAGE_MIME_TYPES = new Set(AI_CONFIG.IMAGE_MIME_TYPES);
const IMAGE_LOAD_FAILED_REPLY = 'gambarnya belum kebaca, coba kirim ulang ya';
const IMAGE_TOO_LARGE_REPLY =
  'gambarnya kegedean, coba kirim versi yang lebih kecil ya';
const VIDEO_LOAD_FAILED_REPLY =
  'videonya belum kebaca, coba kirim ulang atau versi lebih pendek';
const VIDEO_TOO_LARGE_REPLY =
  'videonya kegedean, coba kirim versi yang lebih kecil ya';
const VIDEO_TOO_LONG_REPLY = 'videonya kepanjangan, maksimal 60 detik ya';

/**
 * Resolve the message node that holds WhatsApp media metadata.
 *
 * @param {any} target
 * @returns {any}
 */
const getMediaNode = (target) =>
  target?._rawMessage ||
  target?._rawPayload?.message ||
  target?._rawPayload ||
  target?.message ||
  target;

/**
 * Validate an image attachment before downloading it.
 *
 * @param {any} target
 * @returns {{ mime: string } | { error: 'unsupported' | 'too_large' }}
 */
const getImageMeta = (target) => {
  const media = resolveMediaPayload(getMediaNode(target));
  if (!media || media.mediaType !== 'image') {
    return { error: 'unsupported' };
  }

  const mime = String(media.mimetype || '').toLowerCase();
  if (!IMAGE_MIME_TYPES.has(mime)) {
    return { error: 'unsupported' };
  }

  if (media.fileLength && media.fileLength > AI_CONFIG.MAX_IMAGE_BYTES) {
    return { error: 'too_large' };
  }

  return { mime };
};

/**
 * Download one image and encode it as a provider-ready data URL.
 *
 * @param {any} target
 * @returns {Promise<{ dataUrl: string } | { error: 'unsupported' | 'too_large' | 'failed' }>}
 */
const loadImageDataUrl = async (target) => {
  const meta = getImageMeta(target);
  if (meta.error) return meta;

  try {
    const downloaded = await target.download({
      maxBytes: AI_CONFIG.MAX_IMAGE_BYTES,
    });
    if (!(downloaded instanceof Uint8Array) || downloaded.length === 0) {
      return { error: 'failed' };
    }

    const buffer = Buffer.from(downloaded);
    if (buffer.length > AI_CONFIG.MAX_IMAGE_BYTES) {
      return { error: 'too_large' };
    }

    return {
      dataUrl: `data:${meta.mime};base64,${buffer.toString('base64')}`,
    };
  } catch (err) {
    logger.debug('[AI_CHAT]', `Image download failed: ${err.message}`);
    return { error: 'failed' };
  }
};

/**
 * Validate a video attachment before downloading it.
 *
 * @param {any} target
 * @returns {{ mime: string } | { error: 'unsupported' | 'too_large' }}
 */
const getVideoMeta = (target) => {
  const media = resolveMediaPayload(getMediaNode(target));
  if (!media || media.mediaType !== 'video') {
    return { error: 'unsupported' };
  }

  if (media.fileLength && media.fileLength > AI_CONFIG.MAX_VIDEO_BYTES) {
    return { error: 'too_large' };
  }

  return { mime: String(media.mimetype || 'video/mp4').toLowerCase() };
};

/**
 * Download one video and turn it into sampled frames plus a transcript.
 *
 * @param {any} target
 * @returns {Promise<{ duration: number, frames: Array<{ dataUrl: string, timestamp: number }>, transcript: string } | { error: 'unsupported' | 'too_large' | 'too_long' | 'failed' }>}
 */
const loadVideo = async (target) => {
  const meta = getVideoMeta(target);
  if (meta.error) return meta;

  try {
    const downloaded = await target.download({
      maxBytes: AI_CONFIG.MAX_VIDEO_BYTES,
    });
    if (!(downloaded instanceof Uint8Array) || downloaded.length === 0) {
      return { error: 'failed' };
    }
    if (downloaded.length > AI_CONFIG.MAX_VIDEO_BYTES) {
      return { error: 'too_large' };
    }

    return await prepareVideo(downloaded);
  } catch (err) {
    if (err instanceof VideoError) {
      return { error: err.code };
    }
    logger.debug('[AI_CHAT]', `Video download failed: ${err.message}`);
    return { error: 'failed' };
  }
};

/**
 * Explain what the model is looking at when a video is attached.
 *
 * @param {{ duration: number, frames: Array<{ timestamp: number }>, transcript: string }} video
 * @param {string} [label]
 * @returns {string}
 */
const buildVideoHint = ({ duration, frames, transcript }, label = 'Pesan ini') => {
  const seconds = frames
    .map((frame) => Math.max(0, Math.round(frame.timestamp * 10) / 10))
    .join(', ');
  let hint = `${label} berisi video berdurasi ${Math.max(1, Math.round(duration))} detik. Kamu melihat ${frames.length} frame pada detik ${seconds}.`;
  if (transcript) {
    hint += ` Transkrip audionya: "${transcript}"`;
  }
  return hint;
};

/**
 * Pick the user-facing reply for a failed current-video load.
 *
 * @param {'unsupported' | 'too_large' | 'too_long' | 'failed'} error
 * @returns {string}
 */
const videoFailureReply = (error) => {
  if (error === 'too_long') return VIDEO_TOO_LONG_REPLY;
  if (error === 'too_large') return VIDEO_TOO_LARGE_REPLY;
  return VIDEO_LOAD_FAILED_REPLY;
};

/**
 * Natural Kurisu AI chat middleware.
 * Triggers only when:
 * 1. Bot is explicitly mentioned (@Kurisu)
 * 2. Message quotes / replies to a message sent by the bot
 * 3. Private chat and the message is not a command
 *
 * @type {import('@kurisu/core/services/modules').EventMiddleware<'message'>}
 */
export default async function botAiChatMiddleware(payload, ctx) {
  const { client, msg } = ctx;
  if (!msg || msg.flags?.fromMe || msg.flags?.isBroadcast) return;

  // Ignore if an active command is triggered (with or without prefix)
  if (ctx.command) return;

  // Ignore commands with prefix so we don't interfere with standard bot commands
  if (msg.body?.prefix) return;

  // 1. Silent ignore for stickers (do not respond even if replying to bot)
  if (msg.flags?.isSticker || msg.flags?.isStickerAnimated) return;

  const isGroup = Boolean(msg.flags?.isGroup);

  // Check trigger condition
  const botIdentifiers = new Set(
    [msg.bot?.id, msg.bot?.pn, msg.bot?.lid].filter(Boolean)
  );
  const mentionedJids =
    Array.isArray(msg.body?.mentionedJid) && msg.body.mentionedJid.length > 0
      ? msg.body.mentionedJid
      : extractMentionsFromText(msg.body?.rawText || '');
  const isBotMentioned = mentionedJids.some((jid) => botIdentifiers.has(jid));
  const isReplyToBot = Boolean(msg.quoted?.flags?.fromMe);
  const rawText = (msg.body?.rawText || '').trim();

  // Private chats reply automatically to any non-command message.
  // Group chats require an explicit mention or a reply to the bot.
  if (isGroup && !isBotMentioned && !isReplyToBot) {
    return;
  }

  // 2. Media: images/videos are attached to the model turn; other media stays a hint
  const hasCurrentImage = Boolean(msg.flags?.isImage);
  const hasQuotedImage = Boolean(msg.quoted?.flags?.isImage);
  const hasCurrentVideo = Boolean(msg.flags?.isVideo);
  const hasQuotedVideo = Boolean(msg.quoted?.flags?.isVideo);
  const isMediaMsg = Boolean(
    msg.flags?.isMedia ||
    msg.flags?.isImage ||
    msg.flags?.isVideo ||
    msg.flags?.isAudio ||
    msg.flags?.isDocument
  );

  let cleanedText = rawText;
  for (const botJid of botIdentifiers) {
    const num = botJid.split('@')[0];
    cleanedText = cleanedText.replace(new RegExp(`@${num}`, 'gi'), '').trim();
  }

  if (isMediaMsg) {
    if (hasCurrentImage) {
      // Keep the caption when present; otherwise give the model a short label.
      cleanedText = cleanedText || '[mengirim gambar]';
    } else if (hasCurrentVideo) {
      // Video is processed into frames, so keep the user's question as-is.
      cleanedText = cleanedText || '[mengirim video]';
    } else {
      const mediaType = msg.flags?.isAudio
        ? 'voice note/audio'
        : msg.flags?.isDocument
          ? 'dokumen/file'
          : 'media/file';

      const captionContext = cleanedText
        ? ` dengan caption "${cleanedText}"`
        : '';
      cleanedText = `[mengirim ${mediaType}${captionContext}]`;
    }
  } else if (!cleanedText && (hasQuotedImage || hasQuotedVideo)) {
    cleanedText = hasQuotedImage ? '[membalas gambar]' : '[membalas video]';
  }

  if (!cleanedText) return;

  if (cleanedText.length > AI_CONFIG.MAX_USER_CHARS) {
    await msg.reply('pesannya kepanjangan, ringkas aja');
    return;
  }

  const senderName =
    ctx.tableGroupMember?.pushname ||
    msg.sender?.name ||
    msg.sender?.pn ||
    msg.sender?.id ||
    'Member';

  const rateIdentity =
    msg.sender?.id || msg.sender?.pn || msg.sender?.lid || msg.chat;
  const lockKey = `user:${rateIdentity}`;
  if (activeAiRequests.has(lockKey)) return;

  activeAiRequests.add(lockKey);

  try {
    const userHits = await aiRateLimiter.hit(
      `user:${rateIdentity}`,
      AI_CONFIG.RATE_LIMIT_WINDOW_SECONDS
    );
    const chatHits = await aiRateLimiter.hit(
      `chat:${msg.chat}`,
      AI_CONFIG.RATE_LIMIT_WINDOW_SECONDS
    );

    if (
      userHits > AI_CONFIG.RATE_LIMIT_MAX_REQUESTS ||
      chatHits > AI_CONFIG.CHAT_RATE_LIMIT_MAX_REQUESTS
    ) {
      logger.debug(
        '[AI_CHAT]',
        `Rate limit reached for ${rateIdentity} in ${msg.chat}`
      );
      return;
    }

    // Mark the message as read before the AI request. The read receipt is the
    // visible acknowledgment while waiting; typing only starts when a reply
    // is actually ready to send.
    try {
      if (payload?.key?.id) {
        await client.message.sendReceipt(payload);
      }
    } catch {}

    const imageDataUrls = [];
    const mediaHints = [];

    if (hasCurrentVideo) {
      const currentVideo = await loadVideo(msg);
      if (currentVideo.error) {
        await msg.reply(videoFailureReply(currentVideo.error));
        return;
      }
      imageDataUrls.push(
        ...currentVideo.frames.map((frame) => frame.dataUrl)
      );
      mediaHints.push(buildVideoHint(currentVideo));
    }

    if (hasCurrentImage) {
      const currentImage = await loadImageDataUrl(msg);
      if (currentImage.error) {
        await msg.reply(
          currentImage.error === 'too_large'
            ? IMAGE_TOO_LARGE_REPLY
            : IMAGE_LOAD_FAILED_REPLY
        );
        return;
      }
      imageDataUrls.push(currentImage.dataUrl);
      mediaHints.push('Pesan ini berisi gambar yang bisa kamu lihat.');
    }

    if (
      hasQuotedImage &&
      imageDataUrls.length < AI_CONFIG.MAX_IMAGES_PER_MESSAGE
    ) {
      const quotedImage = await loadImageDataUrl(msg.quoted);
      if (quotedImage.error) {
        mediaHints.push('Gambar di pesan yang dibalas gagal dimuat.');
      } else {
        imageDataUrls.push(quotedImage.dataUrl);
        mediaHints.push(
          'Pesan yang dibalas berisi gambar yang bisa kamu lihat.'
        );
      }
    }

    if (hasQuotedVideo) {
      mediaHints.push('Pesan yang dibalas berisi video.');
    }

    // Links to supported platforms are fetched before the model turn so the
    // model can actually see the clip/image instead of just reading the URL.
    const quotedText = msg.quoted?.body?.rawText || '';
    const currentLink = extractMediaUrl(cleanedText);
    const quotedLink = currentLink ? '' : extractMediaUrl(quotedText);
    const linkUrl = currentLink || quotedLink;
    const linkSource = currentLink ? 'current' : 'quoted';

    if (
      linkUrl &&
      !hasCurrentVideo &&
      !hasCurrentImage &&
      !hasQuotedVideo &&
      !hasQuotedImage &&
      imageDataUrls.length < AI_CONFIG.MAX_IMAGES_PER_MESSAGE
    ) {
      const linked = await loadLinkedMedia(linkUrl);
      if (linked.kind === 'video') {
        imageDataUrls.push(...linked.frames.map((frame) => frame.dataUrl));
        mediaHints.push(
          `${buildVideoHint(
            linked,
            linkSource === 'current' ? 'Pesan ini' : 'Pesan yang dibalas'
          )} Video ini berasal dari link yang dibagikan; jangan panggil tool download untuk link ini. User membagikan media ini dan mengharapkan tanggapan.`
        );
      } else if (linked.kind === 'image') {
        imageDataUrls.push(linked.dataUrl);
        mediaHints.push(
          `${
            linkSource === 'current' ? 'Pesan ini' : 'Pesan yang dibalas'
          } berisi gambar dari link yang bisa kamu lihat. Jangan panggil tool download untuk link ini. User membagikan media ini dan mengharapkan tanggapan.`
        );
      } else {
        mediaHints.push(
          `${
            linkSource === 'current'
              ? 'Media dari link'
              : 'Media dari link di pesan yang dibalas'
          } ${linked.error === 'too_long' ? 'durasinya lebih dari 60 detik, jadi belum bisa dilihat.' : linked.error === 'too_large' ? 'terlalu besar untuk dilihat.' : 'gagal dimuat.'}`
        );
      }
      logger.debug('[AI_LINK]', `Link media ${linked.kind || linked.error}: ${linkUrl}`);
    }

    const groupRole = isGroup
      ? msg.permissions?.bot?.admin || msg.permissions?.bot?.superAdmin
        ? 'admin'
        : 'member'
      : '';

    const personaModes = await resolvePersonaModesWithClient({
      sender: msg.sender,
      tableBot: ctx.tableBot,
      client,
    });

    if (personaModes.length > 0) {
      logger.debug(
        '[AI_CHAT]',
        `Persona mode active: ${personaModes.join('+')} in ${msg.chat}`
      );
    }

    const messagesPayload = await buildChatPayload({
      chatId: msg.chat,
      senderName,
      userText: cleanedText,
      isGroup,
      prefixes: ctx.tableBot?.prefixes,
      mediaContext: mediaHints.join(' '),
      imageDataUrls,
      groupRole,
      directAddress: isGroup,
      personaModes,
    });

    const skillContext = { client, msg, payload, ctx };
    const completionOptions = {
      temperature: AI_CONFIG.TEMPERATURE,
      maxTokens: AI_CONFIG.MAX_TOKENS,
      maxToolRounds: AI_CONFIG.MAX_TOOL_ROUNDS,
      maxToolCalls: AI_CONFIG.MAX_TOOL_CALLS,
      maxToolResultChars: AI_CONFIG.MAX_TOOL_RESULT_CHARS,
      emptyAsNoReply: true,
      tools: getSkillDefinitions(),
      executeTool: (name, rawArgs) => executeSkill(name, rawArgs, skillContext),
    };

    // Group chat only reaches this point through a direct mention or reply.
    // Retry once when the provider returns an empty response. An explicit
    // [NO_REPLY] is respected so closing messages stay silent without typing.
    let replyContent = await createChatCompletion(
      messagesPayload,
      completionOptions
    );

    if (isGroup && !replyContent) {
      logger.debug(
        '[AI_CHAT]',
        `Empty response for direct group message in ${msg.chat}; retrying once`
      );

      replyContent = await createChatCompletion(
        [
          ...messagesPayload,
          {
            role: 'system',
            content:
              '[PESAN LANGSUNG]\nUser menyapa atau membalas kamu langsung di grup ini. Balas pesan terakhir dengan singkat. Jangan keluarkan [NO_REPLY] kecuali pesannya cuma penutup.',
          },
        ],
        completionOptions
      );
    }

    // A skill may have executed a command that already replied to the chat.
    if (ctx.suppressAiReply) {
      if (typeof ctx.stop === 'function') ctx.stop();
      return;
    }

    if (!replyContent) {
      logger.warn('[AI_CHAT]', `Empty AI response in ${msg.chat}`);
    } else if (isNoReply(replyContent)) {
      logger.debug('[AI_CHAT]', `AI chose no reply in ${msg.chat}`);
    }

    if (replyContent) {
      const finalReply = sanitizeAiResponse(replyContent);

      if (isNoReply(finalReply)) {
        logger.debug(
          '[AI_CHAT]',
          `AI chose no reply after sanitize in ${msg.chat}`
        );
        if (typeof ctx.stop === 'function') {
          ctx.stop();
        }
        return;
      }

      // Show typing only after a reply exists, then send it.
      const typingWait = randomDelay(
        AI_CONFIG.TYPING_DELAY_MIN_MS,
        AI_CONFIG.TYPING_DELAY_MAX_MS
      );
      try {
        await client.presence.sendChatstate(msg.chat, { state: 'composing' });
        await delay(typingWait);
      } catch {}
      try {
        await client.presence.sendChatstate(msg.chat, { state: 'paused' });
      } catch {}

      // Save interaction to memory
      const userEntry = isGroup
        ? `[${senderName}]: ${cleanedText}`
        : cleanedText;

      await appendChatHistory(msg.chat, 'user', userEntry);
      await appendChatHistory(msg.chat, 'assistant', finalReply);

      // Reply back to WhatsApp. In voice mode, send a PTT voice note and fall
      // back to text when synthesis or the audio upload fails.
      const voiceMode = getVoiceReplyMode();
      const effectiveVoiceMode =
        voiceMode === 'auto'
          ? wantsVoiceReply(cleanedText || rawText)
            ? 'voice'
            : 'off'
          : voiceMode;

      const sendText = async () => {
        try {
          await msg.reply(finalReply);
        } catch (sendErr) {
          logger.warn(
            '[AI_CHAT]',
            `Quoted reply failed in ${msg.chat}; sending without quote: ${sendErr.message}`
          );
          await msg.send(finalReply);
        }
      };

      if (effectiveVoiceMode === 'both') {
        await sendText();
      }

      const voice =
        effectiveVoiceMode === 'off' ? null : await synthesizeVoice(finalReply);

      if (voice) {
        try {
          await client.message.send(
            msg.chat,
            {
              type: 'audio',
              media: voice.buffer,
              mimetype: voice.mimetype,
              ptt: true,
              seconds: voice.seconds,
            },
            { quote: payload }
          );
        } catch (voiceErr) {
          logger.warn(
            '[AI_CHAT]',
            `Voice reply failed in ${msg.chat}; sending text: ${voiceErr.message}`
          );
          if (effectiveVoiceMode !== 'both') await sendText();
        }
      } else if (effectiveVoiceMode !== 'both') {
        await sendText();
      }

      // Stop event propagation so commands/further handlers do not trigger
      if (typeof ctx.stop === 'function') {
        ctx.stop();
      }
    }
  } catch (err) {
    try {
      await client.presence.sendChatstate(msg.chat, { state: 'paused' });
    } catch {}

    logger.error('[AI_CHAT]', `Kurisu AI chat error: ${err.message}`);
  } finally {
    activeAiRequests.delete(lockKey);
  }
}
