require('dotenv').config();

const { Telegraf, Scenes, session } = require('telegraf');
const { inicializarFirebase } = require('../src/services/firebase');
const { onboardingWizard, ONBOARDING_SCENE_ID } = require('../src/bot/scenes/onboardingScene');
const {
  comandoStart,
  comandoMenu,
  comandoConfirmar,
  comandoCompra,
  comandoRecetas,
  comandoReceta,
  comandoHoy,
  comandoPerfil,
  comandoReset,
  manejarCallbackReset,
} = require('../src/bot/handlers/commands');
const { refinarMenu } = require('../src/bot/handlers/menu');
const { manejarCallbackReceta } = require('../src/bot/handlers/recipes');
const { obtenerUsuario, obtenerMenu } = require('../src/services/firebase');
const { semanaISOActual } = require('../src/utils/dateHelper');

// Inicializar Firebase al arrancar
inicializarFirebase();

// Crear instancia del bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configurar sesiones y escenas
const stage = new Scenes.Stage([onboardingWizard]);
bot.use(session());
bot.use(stage.middleware());

// ─── Comandos ──────────────────────────────────────────────

bot.command('start', comandoStart);
bot.command('menu', comandoMenu);
bot.command('confirmar', comandoConfirmar);
bot.command('compra', comandoCompra);
bot.command('recetas', comandoRecetas);
bot.command('receta', comandoReceta);
bot.command('hoy', comandoHoy);
bot.command('perfil', comandoPerfil);
bot.command('reset', comandoReset);

// ─── Atajos de teclado (reply keyboard) ──────────────────

bot.hears('📅 Ver menú', comandoMenu);
bot.hears('🛒 Lista de compra', comandoCompra);
bot.hears('📖 Recetas', comandoRecetas);
bot.hears('☀️ Menú de hoy', comandoHoy);
bot.hears('👤 Mi perfil', comandoPerfil);
bot.hears('🔄 Nuevo menú', async (ctx) => {
  // Generar nuevo menú aunque ya haya uno
  const { obtenerUsuario } = require('../src/services/firebase');
  const perfil = await obtenerUsuario(ctx.chat.id);
  if (!perfil || !perfil.onboarding_completo) {
    await ctx.reply('Primero necesito conocerte 😊 Escribí /start para comenzar.');
    return;
  }
  const { generarYEnviarMenu } = require('../src/bot/handlers/menu');
  await generarYEnviarMenu(ctx, ctx.chat.id, perfil);
});

// ─── Callbacks inline ────────────────────────────────────

bot.action(/^receta:/, manejarCallbackReceta);
bot.action(/^reset_/, manejarCallbackReset);
bot.action(/^thermomix_/, async (ctx) => {
  // El wizard maneja este callback internamente
  await ctx.answerCbQuery();
});

// ─── Texto libre: refinamiento de menú ───────────────────

bot.on('text', async (ctx) => {
  const texto = ctx.message.text.trim().toLowerCase();
  const chatId = ctx.chat.id;

  // Ignorar si empieza por /
  if (texto.startsWith('/')) return;

  // Verificar si hay un menú en borrador para refinar
  let menu;
  try {
    const semana = semanaISOActual();
    menu = await obtenerMenu(chatId, semana);
  } catch (e) {
    return;
  }

  if (menu && menu.estado === 'borrador') {
    // "confirmar" activa el flujo de lista de compra
    if (texto === 'confirmar') {
      await comandoConfirmar(ctx);
      return;
    }

    // Cualquier otro texto se interpreta como refinamiento del menú
    await refinarMenu(ctx, ctx.message.text);
    return;
  }

  // Sin menú activo: sugerencia de comandos
  await ctx.reply(
    'No entendí eso 😅 Acá algunos comandos útiles:\n\n' +
    '/menu — Ver o generar tu menú\n' +
    '/hoy — Ver el menú de hoy\n' +
    '/recetas — Ver todas las recetas\n' +
    '/compra — Ver la lista de compra\n' +
    '/perfil — Ver tu perfil'
  );
});

// ─── Manejo de errores global ─────────────────────────────

bot.catch((err, ctx) => {
  console.error(`[Bot] Error para chat_id ${ctx?.chat?.id}:`, err.message || err);
  if (ctx?.reply) {
    ctx.reply('Ocurrió un error inesperado. Por favor intentá de nuevo en un momento.').catch(() => {});
  }
});

// ─── Exportar para Vercel (serverless) ───────────────────

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[Webhook] Error procesando update:', error.message);
      res.status(200).json({ ok: false, error: error.message });
    }
  } else {
    res.status(200).json({ status: 'AgentChef bot corriendo ✅' });
  }
};
