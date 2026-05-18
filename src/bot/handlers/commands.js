const { Markup } = require('telegraf');
const { obtenerUsuario, eliminarUsuario } = require('../../services/firebase');
const { mostrarMenuActual, generarYEnviarMenu } = require('./menu');
const { generarYEnviarListaCompra, mostrarListaCompra } = require('./shopping');
const { mostrarReceta, mostrarListaRecetas } = require('./recipes');
const { semanaISOActual, diaSemanaEnMadrid, fechaDeHoyFormateada, nombreDia } = require('../../utils/dateHelper');
const { obtenerMenu } = require('../../services/firebase');
const { ONBOARDING_SCENE_ID } = require('../scenes/onboardingScene');

// /start
async function comandoStart(ctx) {
  const chatId = ctx.chat.id;

  let perfil;
  try {
    perfil = await obtenerUsuario(chatId);
  } catch (e) {
    console.error('[Commands] Error en /start:', e.message);
    await ctx.reply('Hubo un error conectando con la base de datos. Intentá de nuevo en un momento.');
    return;
  }

  if (perfil && perfil.onboarding_completo) {
    const semana = semanaISOActual();
    let menu;
    try {
      menu = await obtenerMenu(chatId, semana);
    } catch (e) {
      menu = null;
    }

    const estadoMenu = menu
      ? `📅 Menú de esta semana: ${menu.estado === 'confirmado' ? '✅ confirmado' : '📝 en borrador'}`
      : '📅 Sin menú para esta semana';

    await ctx.reply(
      `¡Hola de nuevo, ${perfil.nombre}! 👋\n\n${estadoMenu}\n\n*¿Qué querés hacer?*`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          ['📅 Ver menú', '🛒 Lista de compra'],
          ['📖 Recetas', '☀️ Menú de hoy'],
          ['👤 Mi perfil', '🔄 Nuevo menú'],
        ]).resize(),
      }
    );
    return;
  }

  // Iniciar onboarding
  await ctx.scene.enter(ONBOARDING_SCENE_ID);
}

// /menu
async function comandoMenu(ctx) {
  const chatId = ctx.chat.id;

  let perfil;
  try {
    perfil = await obtenerUsuario(chatId);
  } catch (e) {
    await ctx.reply('Error obteniendo tu perfil. Intentá de nuevo.');
    return;
  }

  if (!perfil || !perfil.onboarding_completo) {
    await ctx.reply('Primero necesito conocerte 😊 Escribí /start para comenzar.');
    return;
  }

  await mostrarMenuActual(ctx);
}

// /confirmar
async function comandoConfirmar(ctx) {
  const chatId = ctx.chat.id;
  const semana = semanaISOActual();

  let menu;
  try {
    menu = await obtenerMenu(chatId, semana);
  } catch (e) {
    await ctx.reply('Error obteniendo tu menú. Intentá de nuevo.');
    return;
  }

  if (!menu) {
    await ctx.reply('No tenés un menú para esta semana. Escribí /menu para generar uno.');
    return;
  }

  if (menu.estado === 'confirmado') {
    await ctx.reply('Tu menú ya está confirmado. ¿Querés ver la lista de la compra? Escribí /compra.');
    return;
  }

  await generarYEnviarListaCompra(ctx);
}

// /compra
async function comandoCompra(ctx) {
  await mostrarListaCompra(ctx);
}

// /recetas
async function comandoRecetas(ctx) {
  await mostrarListaRecetas(ctx);
}

// /receta [nombre]
async function comandoReceta(ctx) {
  const texto = ctx.message.text.replace('/receta', '').trim();

  if (!texto) {
    await ctx.reply('Por favor indicá el nombre del plato. Por ejemplo: /receta pasta al pesto');
    return;
  }

  await mostrarReceta(ctx, texto);
}

// /hoy
async function comandoHoy(ctx) {
  const chatId = ctx.chat.id;
  const semana = semanaISOActual();
  const diaActual = diaSemanaEnMadrid();

  let perfil, menu;
  try {
    const firebase = require('../../services/firebase');
    [perfil, menu] = await Promise.all([
      firebase.obtenerUsuario(chatId),
      firebase.obtenerMenu(chatId, semana),
    ]);
  } catch (e) {
    await ctx.reply('Error obteniendo tus datos. Intentá de nuevo.');
    return;
  }

  if (!perfil || !perfil.onboarding_completo) {
    await ctx.reply('Primero necesito conocerte 😊 Escribí /start para comenzar.');
    return;
  }

  if (!menu || menu.estado !== 'confirmado') {
    await ctx.reply(
      `¡Buenos días, ${perfil.nombre}! Aún no tenés menú confirmado para esta semana. Escribí /menu para armar uno 📅`
    );
    return;
  }

  const diaData = menu.dias[diaActual];
  if (!diaData) {
    await ctx.reply('No hay datos para hoy en tu menú. Puede que sea un día no planificado.');
    return;
  }

  const fechaHoy = fechaDeHoyFormateada();
  const nombreDiaCapitalizado = diaActual.charAt(0).toUpperCase() + diaActual.slice(1);

  // Buscar ingredientes relevantes de la lista de compra para hoy
  let ingredientesHoy = [];
  if (menu.lista_compra?.items) {
    // Heurística simple: mostrar algunos ingredientes de los platos de hoy
    ingredientesHoy = menu.lista_compra.items.slice(0, 4).map((i) => `\\- ${escapeMarkdown(i.ingrediente)} — ${escapeMarkdown(i.cantidad)}`);
  }

  const almuerzo = diaData.almuerzo?.nombre || 'No definido';
  const cena = diaData.cena?.nombre || 'No definido';
  const tiempoAlmuerzo = diaData.almuerzo?.tiempo_estimado;
  const tiempoCena = diaData.cena?.tiempo_estimado;

  const lineas = [
    `☀️ *¡Buenos días, ${escapeMarkdown(perfil.nombre)}\\!*`,
    ``,
    `🍽️ *Tu menú de hoy — ${escapeMarkdown(nombreDiaCapitalizado)} ${escapeMarkdown(fechaHoy)}*`,
    ``,
    `🌞 Almuerzo: ${escapeMarkdown(almuerzo)}${tiempoAlmuerzo ? ` \\(⏱️ ~${tiempoAlmuerzo} min\\)` : ''}`,
    `🌙 Cena: ${escapeMarkdown(cena)}${tiempoCena ? ` \\(⏱️ ~${tiempoCena} min\\)` : ''}`,
  ];

  if (ingredientesHoy.length > 0) {
    lineas.push('');
    lineas.push('🛒 *Recordatorio de compra*');
    lineas.push('Para hoy puede que necesites:');
    lineas.push(...ingredientesHoy);
  }

  lineas.push('');
  lineas.push('Escribí /recetas para ver las recetas completas 👨‍🍳');

  await ctx.reply(lineas.join('\n'), { parse_mode: 'MarkdownV2' });
}

// /perfil
async function comandoPerfil(ctx) {
  const chatId = ctx.chat.id;

  let perfil;
  try {
    perfil = await obtenerUsuario(chatId);
  } catch (e) {
    await ctx.reply('Error obteniendo tu perfil. Intentá de nuevo.');
    return;
  }

  if (!perfil || !perfil.onboarding_completo) {
    await ctx.reply('Todavía no tenés un perfil. Escribí /start para comenzar.');
    return;
  }

  const lineas = [
    `👤 *Tu perfil*`,
    ``,
    `*Nombre:* ${escapeMarkdown(perfil.nombre || 'No especificado')}`,
    `*Personas:* ${perfil.personas || 2}`,
    `*Objetivos:* ${escapeMarkdown((perfil.objetivos || []).join(', ') || 'No especificados')}`,
    `*Tipos de cocina:* ${escapeMarkdown((perfil.tipos_comida || []).join(', ') || 'No especificados')}`,
    `*Le gusta:* ${escapeMarkdown((perfil.gustos || []).join(', ') || 'No especificado')}`,
    `*No le gusta:* ${escapeMarkdown((perfil.no_gusta || []).join(', ') || 'Ninguno')}`,
    `*Alergias:* ${escapeMarkdown((perfil.alergias || []).join(', ') || 'Ninguna')}`,
    `*Thermomix:* ${perfil.tiene_thermomix ? 'Sí ✅' : 'No'}`,
    ``,
    `_Para actualizar tu perfil, usá /reset para empezar de nuevo\\._`,
  ];

  await ctx.reply(lineas.join('\n'), { parse_mode: 'MarkdownV2' });
}

// /reset
async function comandoReset(ctx) {
  await ctx.reply(
    '⚠️ *¿Estás seguro de que querés borrar tu perfil y menú?*\n\nEsta acción no se puede deshacer. Tendrás que volver a completar el onboarding.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🗑️ Sí, borrar todo', 'reset_confirmar'),
          Markup.button.callback('❌ Cancelar', 'reset_cancelar'),
        ],
      ]),
    }
  );
}

async function manejarCallbackReset(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  if (data === 'reset_cancelar') {
    await ctx.editMessageText('Operación cancelada. Tu perfil sigue igual 👍');
    return;
  }

  if (data === 'reset_confirmar') {
    const chatId = ctx.chat.id;
    try {
      await eliminarUsuario(chatId);
    } catch (e) {
      console.error('[Commands] Error en reset:', e.message);
      await ctx.editMessageText('Hubo un error borrando tu perfil. Intentá de nuevo.');
      return;
    }

    await ctx.editMessageText('✅ Perfil borrado. ¡Empecemos de nuevo!');
    await ctx.scene.enter(ONBOARDING_SCENE_ID);
  }
}

function escapeMarkdown(texto) {
  if (!texto) return '';
  return String(texto).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

module.exports = {
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
};
