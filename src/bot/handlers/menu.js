const { llamarLLMConJSON } = require('../../services/llm');
const { guardarMenu, obtenerMenu, obtenerUsuario } = require('../../services/firebase');
const { validarMenu } = require('../../utils/parser');
const { semanaISOActual, formatearFechaSemana, DIAS_ORDEN } = require('../../utils/dateHelper');
const { escapeMarkdownV2, replyMarkdownV2 } = require('../../utils/telegram');

const EMOJIS_DIAS = {
  lunes: '🟢',
  martes: '🟡',
  miercoles: '🟠',
  jueves: '🔵',
  viernes: '🟣',
  sabado: '🔴',
  domingo: '⚪',
};

function construirPromptMenu(perfil) {
  return `Genera un menú semanal completo (lunes a domingo, almuerzo y cena) para este usuario.

PERFIL DEL USUARIO:
${JSON.stringify(perfil, null, 2)}

REGLAS:
- No repetir la misma proteína principal más de 2 días seguidos
- Respetar el tiempo disponible para cocinar cada día
- Usar ingredientes disponibles en heladera/despensa cuando sea posible
- Ajustar complejidad al tiempo disponible: días con poco tiempo = recetas simples
- Los fines de semana pueden ser más elaborados
- Variedad de tipos de cocina según las preferencias del usuario
- Equilibrio nutricional a lo largo de la semana

Responde ÚNICAMENTE con JSON válido (sin markdown ni texto extra).
Estructura obligatoria:
{
  "semana": "${semanaISOActual()}",
  "dias": {
    "lunes": { "almuerzo": { "nombre": "...", "tiempo_estimado": 30 }, "cena": { "nombre": "...", "tiempo_estimado": 20 } },
    "martes": { "almuerzo": { "nombre": "...", "tiempo_estimado": 30 }, "cena": { "nombre": "...", "tiempo_estimado": 20 } },
    "miercoles": { "almuerzo": { "nombre": "...", "tiempo_estimado": 30 }, "cena": { "nombre": "...", "tiempo_estimado": 20 } },
    "jueves": { "almuerzo": { "nombre": "...", "tiempo_estimado": 30 }, "cena": { "nombre": "...", "tiempo_estimado": 20 } },
    "viernes": { "almuerzo": { "nombre": "...", "tiempo_estimado": 30 }, "cena": { "nombre": "...", "tiempo_estimado": 20 } },
    "sabado": { "almuerzo": { "nombre": "...", "tiempo_estimado": 30 }, "cena": { "nombre": "...", "tiempo_estimado": 20 } },
    "domingo": { "almuerzo": { "nombre": "...", "tiempo_estimado": 30 }, "cena": { "nombre": "...", "tiempo_estimado": 20 } }
  }
}
Las claves de "dias" deben ser exactamente: lunes, martes, miercoles, jueves, viernes, sabado, domingo (sin acentos).`;
}

function construirPromptRefinamiento(menuActual, mensajeUsuario, perfil) {
  return `El usuario tiene este menú semanal actual:
${JSON.stringify(menuActual.dias, null, 2)}

El usuario dice: "${mensajeUsuario}"

Perfil del usuario: ${JSON.stringify({ personas: perfil.personas, tiempo_por_dia: perfil.tiempo_por_dia, gustos: perfil.gustos, no_gusta: perfil.no_gusta }, null, 2)}

Modifica SOLO los días y comidas que el usuario menciona o que son necesarios cambiar.
Mantén el resto igual.

Responde ÚNICAMENTE con JSON con la misma estructura del menú, incluyendo TODOS los días
(los no modificados igual que estaban, los modificados con los cambios aplicados).
Incluye también un campo "cambios_realizados" con array de strings describiendo brevemente qué cambiaste.

Estructura:
{
  "semana": "${menuActual.semana}",
  "dias": { ... todos los días ... },
  "cambios_realizados": ["string", ...]
}`;
}

function formatearMenu(menuData, semanaIso) {
  const rango = escapeMarkdownV2(formatearFechaSemana(semanaIso));
  const lineas = [`📅 *MENÚ SEMANA DEL ${rango}*`];

  for (const dia of DIAS_ORDEN) {
    const datos = menuData.dias[dia];
    if (!datos) continue;

    const emoji = EMOJIS_DIAS[dia] || '⭕';
    const nombreDia = escapeMarkdownV2(dia.charAt(0).toUpperCase() + dia.slice(1));

    lineas.push('');
    lineas.push(`${emoji} *${nombreDia.toUpperCase()}*`);
    lineas.push(`  🍽️ Almuerzo: ${escapeMarkdownV2(datos.almuerzo.nombre)}`);
    lineas.push(`  🌙 Cena: ${escapeMarkdownV2(datos.cena.nombre)}`);
  }

  lineas.push('');
  lineas.push('─────────────────────');
  lineas.push('¿Qué te parece? Podés decirme si algo no te gusta, si un día tenés menos tiempo, si habrá más personas, o escribí *confirmar* para seguir con la lista de la compra\\.');

  return lineas.join('\n');
}

async function generarYEnviarMenu(ctx, chatId, perfil) {
  const semana = semanaISOActual();

  // Verificar si ya existe un menú para esta semana
  let menuExistente = null;
  try {
    menuExistente = await obtenerMenu(chatId, semana);
  } catch (e) {
    console.warn('[Menu] No se pudo verificar menú existente:', e.message);
  }

  if (menuExistente && menuExistente.estado === 'confirmado') {
    await ctx.reply(
      `Ya tenés un menú confirmado para esta semana\\. Usá /menu para verlo o /compra para ver la lista de la compra\\.`,
      { parse_mode: 'MarkdownV2' }
    );
    return;
  }

  const msgEspera = await ctx.reply(`Perfecto ${perfil.nombre}, estoy armando tu menú... 🧑‍🍳`);

  let menuData;
  try {
    const prompt = construirPromptMenu(perfil);
    menuData = await llamarLLMConJSON(prompt, undefined, validarMenu, 2);
  } catch (error) {
    console.error('[Menu] Error generando menú:', error.message);
    await ctx.reply('Hubo un problema generando tu menú. Por favor intentá de nuevo en unos minutos.');
    return;
  }

  // Guardar en Firestore como borrador
  try {
    await guardarMenu(chatId, semana, {
      ...menuData,
      estado: 'borrador',
    });
  } catch (error) {
    console.error('[Menu] Error guardando menú:', error.message);
  }

  // Enviar menú al usuario
  const textoMenu = formatearMenu(menuData, semana);
  await replyMarkdownV2(ctx, textoMenu);
}

async function mostrarMenuActual(ctx) {
  const chatId = ctx.chat.id;
  const semana = semanaISOActual();

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

  let menu;
  try {
    menu = await obtenerMenu(chatId, semana);
  } catch (e) {
    await ctx.reply('Error obteniendo tu menú. Intentá de nuevo.');
    return;
  }

  if (!menu) {
    await generarYEnviarMenu(ctx, chatId, perfil);
    return;
  }

  const textoMenu = formatearMenu(menu, semana);
  await replyMarkdownV2(ctx, textoMenu);
}

async function refinarMenu(ctx, mensajeUsuario) {
  const chatId = ctx.chat.id;
  const semana = semanaISOActual();

  let perfil, menu;
  try {
    [perfil, menu] = await Promise.all([obtenerUsuario(chatId), obtenerMenu(chatId, semana)]);
  } catch (e) {
    await ctx.reply('Error obteniendo tus datos. Intentá de nuevo.');
    return;
  }

  if (!menu || menu.estado === 'confirmado') {
    await ctx.reply('No hay un menú en borrador para modificar. Usá /menu para generar uno nuevo.');
    return;
  }

  await ctx.reply('Actualizando tu menú... ✏️');

  let menuActualizado;
  try {
    const prompt = construirPromptRefinamiento(menu, mensajeUsuario, perfil);
    menuActualizado = await llamarLLMConJSON(prompt, undefined, validarMenu);
  } catch (error) {
    console.error('[Menu] Error refinando menú:', error.message);
    await ctx.reply('No pude procesar ese cambio. Probá ser más específico, por ejemplo: "Cambiá la cena del martes" o "El jueves tengo poco tiempo".');
    return;
  }

  // Actualizar en Firestore
  try {
    const { guardarMenu } = require('../../services/firebase');
    await guardarMenu(chatId, semana, {
      ...menuActualizado,
      estado: 'borrador',
    });
  } catch (error) {
    console.error('[Menu] Error guardando menú actualizado:', error.message);
  }

  // Mostrar cambios realizados
  const cambios = menuActualizado.cambios_realizados;
  if (cambios && cambios.length > 0) {
    const textoCambios = cambios.map((c) => `\\- ${escapeMarkdownV2(c)}`).join('\n');
    await replyMarkdownV2(ctx, `*Cambios realizados:*\n${textoCambios}`);
  }

  // Mostrar menú actualizado
  const textoMenu = formatearMenu(menuActualizado, semana);
  await replyMarkdownV2(ctx, textoMenu);
}

module.exports = {
  generarYEnviarMenu,
  mostrarMenuActual,
  refinarMenu,
  formatearMenu,
  DIAS_ORDEN,
};
