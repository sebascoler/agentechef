const { Markup } = require('telegraf');
const { llamarLLM } = require('../../services/llm');
const { obtenerMenu, obtenerUsuario, obtenerReceta, guardarReceta } = require('../../services/firebase');
const { parsearJSON, validarReceta } = require('../../utils/parser');
const { formatearReceta, generarIdReceta } = require('../../utils/thermomix');
const { semanaISOActual, DIAS_ORDEN } = require('../../utils/dateHelper');

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
  await ctx.reply(texto, {
    parse_mode: 'MarkdownV2',
    disable_web_page_preview: true,
  });
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

  // Recolectar todos los platos únicos
  const platos = [];
  for (const dia of DIAS_ORDEN) {
    const datos = menu.dias[dia];
    if (!datos) continue;
    if (datos.almuerzo?.nombre) platos.push(datos.almuerzo.nombre);
    if (datos.cena?.nombre) platos.push(datos.cena.nombre);
  }

  if (platos.length === 0) {
    await ctx.reply('No hay platos en el menú de esta semana.');
    return;
  }

  // Crear botones inline (máx 2 por fila)
  const botones = [];
  for (let i = 0; i < platos.length; i += 2) {
    const fila = [Markup.button.callback(`🍽️ ${truncar(platos[i], 28)}`, `receta:${platos[i]}`)];
    if (platos[i + 1]) {
      fila.push(Markup.button.callback(`🍽️ ${truncar(platos[i + 1], 28)}`, `receta:${platos[i + 1]}`));
    }
    botones.push(fila);
  }

  await ctx.reply(
    '📖 *Recetas de esta semana*\n\nElegí un plato para ver la receta completa:',
    {
      parse_mode: 'MarkdownV2',
      ...Markup.inlineKeyboard(botones),
    }
  );
}

async function manejarCallbackReceta(ctx) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('receta:')) return;

  const nombrePlato = data.slice('receta:'.length);
  await ctx.answerCbQuery();
  await mostrarReceta(ctx, nombrePlato);
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
