const { llamarLLM } = require('../../services/llm');
const { obtenerMenu, obtenerUsuario, actualizarMenu } = require('../../services/firebase');
const { parsearJSON, validarListaCompra } = require('../../utils/parser');
const { semanaISOActual, formatearFechaSemana } = require('../../utils/dateHelper');

const CATEGORIAS = {
  carnes: { emoji: '🥩', nombre: 'Carnes y proteínas' },
  verduras: { emoji: '🥦', nombre: 'Verduras y frutas' },
  lacteos: { emoji: '🥛', nombre: 'Lácteos' },
  pasta_arroz_legumbres: { emoji: '🌾', nombre: 'Pasta, arroz y legumbres' },
  otros: { emoji: '🫙', nombre: 'Otros' },
};

function construirPromptListaCompra(menu, perfil) {
  const heladera = [...(perfil.heladera_actual || []), ...(perfil.despensa_actual || [])];

  return `Genera la lista de la compra para este menú semanal.

MENÚ CONFIRMADO:
${JSON.stringify(menu.dias, null, 2)}

PERFIL DEL USUARIO:
- Personas: ${perfil.personas}
- Ya tiene en casa: ${heladera.length > 0 ? heladera.join(', ') : 'nada especificado'}

REGLAS:
- Consolida ingredientes: si varios platos usan el mismo ingrediente, súmalo
- Ajusta cantidades para ${perfil.personas} personas
- NO incluyas lo que ya tiene en casa (heladera/despensa)
- Agrupa por categoría: carnes, verduras, lacteos, pasta_arroz_legumbres, otros

Responde ÚNICAMENTE con este JSON:
{
  "items": [
    {
      "ingrediente": "string",
      "cantidad": "string",
      "categoria": "carnes | verduras | lacteos | pasta_arroz_legumbres | otros"
    }
  ]
}`;
}

function formatearListaCompra(listaData, semanaIso) {
  const rango = formatearFechaSemana(semanaIso);
  const lineas = [`✅ *Menú confirmado\\!*`, ``, `🛒 *LISTA DE LA COMPRA — SEMANA ${escapeMarkdown(rango)}*`];

  // Agrupar por categoría
  const porCategoria = {};
  for (const item of listaData.items) {
    const cat = item.categoria || 'otros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(item);
  }

  // Mostrar en orden de categorías definidas
  for (const [catKey, catInfo] of Object.entries(CATEGORIAS)) {
    const items = porCategoria[catKey];
    if (!items || items.length === 0) continue;

    lineas.push('');
    lineas.push(`${catInfo.emoji} *${catInfo.nombre}*`);
    for (const item of items) {
      lineas.push(`\\- ${escapeMarkdown(item.ingrediente)} — ${escapeMarkdown(item.cantidad)}`);
    }
  }

  lineas.push('');
  lineas.push('─────────────────────');
  lineas.push('Ya tenés todo guardado\\. Usá /recetas para ver todas las recetas de la semana o /hoy para ver qué toca hoy\\.');

  return lineas.join('\n');
}

async function generarYEnviarListaCompra(ctx) {
  const chatId = ctx.chat.id;
  const semana = semanaISOActual();

  let perfil, menu;
  try {
    [perfil, menu] = await Promise.all([obtenerUsuario(chatId), obtenerMenu(chatId, semana)]);
  } catch (e) {
    await ctx.reply('Error obteniendo tus datos. Intentá de nuevo.');
    return;
  }

  if (!perfil || !perfil.onboarding_completo) {
    await ctx.reply('Primero necesito conocerte 😊 Escribí /start para comenzar.');
    return;
  }

  if (!menu) {
    await ctx.reply('No tenés un menú para esta semana. Escribí /menu para generar uno.');
    return;
  }

  // Si ya hay lista confirmada, mostrarla directamente
  if (menu.lista_compra && menu.lista_compra.confirmada) {
    const texto = formatearListaCompra(menu.lista_compra, semana);
    await ctx.reply(texto, { parse_mode: 'MarkdownV2' });
    return;
  }

  await ctx.reply('Armando tu lista de la compra... 🛒');

  let listaData;
  try {
    const prompt = construirPromptListaCompra(menu, perfil);
    const respuesta = await llamarLLM(prompt);
    listaData = parsearJSON(respuesta);
    validarListaCompra(listaData);
  } catch (error) {
    console.error('[Shopping] Error generando lista:', error.message);
    await ctx.reply('Hubo un problema generando la lista de compra. Por favor intentá de nuevo.');
    return;
  }

  // Guardar lista en Firestore y marcar menú como confirmado
  try {
    await actualizarMenu(chatId, semana, {
      estado: 'confirmado',
      lista_compra: {
        confirmada: true,
        items: listaData.items,
      },
    });
  } catch (error) {
    console.error('[Shopping] Error guardando lista:', error.message);
  }

  const texto = formatearListaCompra(listaData, semana);
  await ctx.reply(texto, { parse_mode: 'MarkdownV2' });
}

async function mostrarListaCompra(ctx) {
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

  if (!menu.lista_compra || !menu.lista_compra.confirmada) {
    await ctx.reply('Todavía no generaste la lista de compra. Confirmá tu menú con /confirmar.');
    return;
  }

  const texto = formatearListaCompra(menu.lista_compra, semana);
  await ctx.reply(texto, { parse_mode: 'MarkdownV2' });
}

function escapeMarkdown(texto) {
  if (!texto) return '';
  return String(texto).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

module.exports = {
  generarYEnviarListaCompra,
  mostrarListaCompra,
};
