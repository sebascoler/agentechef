/**
 * Utilidades para enviar mensajes con MarkdownV2 en Telegram.
 * https://core.telegram.org/bots/api#markdownv2-style
 */

function escapeMarkdownV2(texto) {
  if (texto == null) return '';
  return String(texto).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

async function replyMarkdownV2(ctx, texto, opciones = {}) {
  try {
    return await ctx.reply(texto, { parse_mode: 'MarkdownV2', ...opciones });
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes("can't parse entities")) {
      console.warn('[Telegram] MarkdownV2 inválido, reenviando sin formato:', msg.slice(0, 120));
      const { parse_mode, ...resto } = opciones;
      return ctx.reply(desescaparMarkdownV2(texto), resto);
    }
    throw error;
  }
}

function desescaparMarkdownV2(texto) {
  return String(texto).replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1');
}

module.exports = {
  escapeMarkdownV2,
  replyMarkdownV2,
  desescaparMarkdownV2,
};
