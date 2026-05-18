const { Markup } = require('telegraf');
const { llamarLLM } = require('../../services/llm');
const { obtenerMenu, obtenerUsuario, obtenerReceta, guardarReceta } = require('../../services/firebase');
const { parsearJSON, validarReceta } = require('../../utils/parser');
const { formatearReceta, generarIdReceta } = require('../../utils/thermomix');
const { semanaISOActual, DIAS_ORDEN } = require('../../utils/dateHelper');
const { replyMarkdownV2 } = require('../../utils/telegram');

function construirPromptReceta(nombrePlato, personas, tieneThermomix) {
  return `Genera la receta completa de "${nombrePlato}" para ${personas} personas.
El usuario tiene Thermomix TM6: ${tieneThermomix ? 'SÍ' : 'NO'}

${tieneThermomix ? 'Incluye la configuración completa en cada paso (temperatura, velocidad, tiempo, función). Si un paso no requiere Thermomix, ponlo como "sin_thermomix": true.' : 'No incluyas configuración Thermomix.'}

Responde ÚNICAMENTE con este JSON:
{
  "nombre": "string",
  "porciones": ${personas},
  "tiempo_total": 30,
  "thermomix": ${tieneThermomix},
  "ingredientes": [
    { "nombre": "string", "cantidad": "string" }
  ],
  "pasos": [
    {
      "numero": 1,
      "instruccion": "string",
      "sin_thermomix": false,
      "thermomix_config": {
        "tiempo": "5 min",
        "temperatura": "100°C",
        "velocidad": "4",
        "funcion": "normal"
      }
    }
  ],
  "notas": "string"
}`;
}

async function obtenerOGenerarReceta(chatId, nombrePlato, personas, tieneThermomix) {
  const recetaId = generarIdReceta(nombrePlato);

  // Verificar caché en Firestore
  let receta = null;
  try {
    receta = await obtenerReceta(chatId, recetaId);
  } catch (e) {
    console.warn('[Recipes] Error buscando receta en caché:', e.message);
  }

  if (receta) {
    console.log(`[Recipes] Usando receta cacheada: ${recetaId}`);
    return receta;
  }

  // Generar con LLM
  console.log(`[Recipes] Generando receta: ${nombrePlato}`);
  const prompt = construirPromptReceta(nombrePlato, personas, tieneThermomix);
  const respuesta = await llamarLLM(prompt);
  const datos = parsearJSON(respuesta);
  validarReceta(datos);

  // Guardar en Firestore
  try {
    await guardarReceta(chatId, recetaId, datos);
  } catch (e) {
    console.warn('[Recipes] Error guardando receta:', e.message);
  }

  return datos;
}

async function mostrarReceta(ctx, nombrePlato) {
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

  await ctx.reply(`Buscando la receta de ${nombrePlato}... 👨‍🍳`);

  let receta;
  try {
    receta = await obtenerOGenerarReceta(
      chatId,
      nombrePlato,
      perfil.personas || 2,
      perfil.tiene_thermomix || false
    );
  } catch (error) {
    console.error('[Recipes] Error obteniendo receta:', error.message);
    await ctx.reply('No pude obtener esa receta. Por favor intentá de nuevo.');
    return;
  }

  const texto = formatearReceta(receta, perfil.tiene_thermomix || false);
  await replyMarkdownV2(ctx, texto, { disable_web_page_preview: true });
}

async function mostrarListaRecetas(ctx) {
  const chatId = ctx.chat.id;
  const semana = semanaISOActual();

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

  if (!menu || !menu.dias) {
    await ctx.reply('No tenés un menú para esta semana. Escribí /menu para generar uno.');
    return;
  }

  const platos = recolectarPlatosDelMenu(menu);

  if (platos.length === 0) {
    await ctx.reply('No hay platos en el menú de esta semana.');
    return;
  }

  // Telegram: callback_data máximo 64 bytes — usamos id corto, no el nombre completo
  const botones = [];
  for (let i = 0; i < platos.length; i += 2) {
    const fila = [
      Markup.button.callback(`🍽️ ${truncar(platos[i].nombre, 28)}`, `receta:${platos[i].id}`),
    ];
    if (platos[i + 1]) {
      fila.push(
        Markup.button.callback(
          `🍽️ ${truncar(platos[i + 1].nombre, 28)}`,
          `receta:${platos[i + 1].id}`
        )
      );
    }
    botones.push(fila);
  }

  await replyMarkdownV2(
    ctx,
    '📖 *Recetas de esta semana*\n\nElegí un plato para ver la receta completa:',
    Markup.inlineKeyboard(botones)
  );
}

async function manejarCallbackReceta(ctx) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('receta:')) return;

  const recetaId = data.slice('receta:'.length);
  const chatId = ctx.chat.id;

  let nombrePlato;
  try {
    nombrePlato = await resolverNombrePlatoPorId(chatId, recetaId);
  } catch (e) {
    await ctx.answerCbQuery({ text: 'Error buscando el plato', show_alert: true });
    return;
  }

  if (!nombrePlato) {
    await ctx.answerCbQuery({ text: 'No encontré ese plato en tu menú', show_alert: true });
    return;
  }

  await ctx.answerCbQuery();
  await mostrarReceta(ctx, nombrePlato);
}

function recolectarPlatosDelMenu(menu) {
  const vistos = new Set();
  const platos = [];

  for (const dia of DIAS_ORDEN) {
    const datos = menu.dias[dia];
    if (!datos) continue;

    for (const comida of [datos.almuerzo, datos.cena]) {
      if (!comida?.nombre) continue;
      const id = generarIdReceta(comida.nombre);
      if (vistos.has(id)) continue;
      vistos.add(id);
      platos.push({ id, nombre: comida.nombre });
    }
  }

  return platos;
}

async function resolverNombrePlatoPorId(chatId, recetaId) {
  const semana = semanaISOActual();
  const menu = await obtenerMenu(chatId, semana);

  if (menu?.dias) {
    for (const dia of DIAS_ORDEN) {
      const datos = menu.dias[dia];
      if (!datos) continue;
      for (const comida of [datos.almuerzo, datos.cena]) {
        if (comida?.nombre && generarIdReceta(comida.nombre) === recetaId) {
          return comida.nombre;
        }
      }
    }
  }

  const receta = await obtenerReceta(chatId, recetaId);
  if (receta?.nombre) return receta.nombre;

  return null;
}

function truncar(texto, max) {
  if (texto.length <= max) return texto;
  return texto.substring(0, max - 3) + '...';
}

module.exports = {
  mostrarReceta,
  mostrarListaRecetas,
  manejarCallbackReceta,
  obtenerOGenerarReceta,
};
