const https = require('https');

/**
 * Envía un mensaje de Telegram directamente via HTTP (sin instancia del bot).
 * Útil desde el cron job que corre en contexto serverless independiente.
 */
function enviarMensajeTelegram(chatId, texto, parseMode = 'MarkdownV2') {
  return new Promise((resolve, reject) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const cuerpo = JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    });

    const opciones = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(cuerpo),
      },
    };

    const req = https.request(opciones, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            resolve(json);
          } else {
            reject(new Error(`Telegram API error: ${json.description}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout enviando mensaje a Telegram'));
    });

    req.write(cuerpo);
    req.end();
  });
}

module.exports = { enviarMensajeTelegram };
