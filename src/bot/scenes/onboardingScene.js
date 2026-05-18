const { Scenes } = require('telegraf');
const { guardarUsuario } = require('../../services/firebase');

const ONBOARDING_SCENE_ID = 'onboarding';

/**
 * WizardScene de 8 pasos para recopilar el perfil del usuario.
 * Cada paso hace UNA pregunta y espera la respuesta antes de continuar.
 */

// Paso 1: Nombre
const paso1 = new Scenes.WizardScene(
  ONBOARDING_SCENE_ID,

  // PASO 1 — Nombre
  async (ctx) => {
    ctx.wizard.state.perfil = {};
    await ctx.reply(
      '¡Hola! Soy tu asistente de menú semanal 🍽️\n\nVoy a hacerte unas preguntas para conocerte mejor y armar menús que te encanten.\n\n¿Cómo te llamás?'
    );
    return ctx.wizard.next();
  },

  // PASO 2 — Personas
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.perfil.nombre = ctx.message.text.trim();

    await ctx.reply(
      `Genial, ${ctx.wizard.state.perfil.nombre}! 😊\n\n¿Para cuántas personas cocinás habitualmente?`
    );
    return ctx.wizard.next();
  },

  // PASO 3 — Objetivos
  async (ctx) => {
    if (!ctx.message?.text) return;
    const texto = ctx.message.text.trim();
    const numero = parseInt(texto, 10);
    ctx.wizard.state.perfil.personas = isNaN(numero) ? 2 : numero;

    await ctx.reply(
      '¿Tenés algún objetivo con la alimentación?\n\n_Por ejemplo: comer sano, perder peso, ganar músculo, más variedad, cocinar rápido, etc._',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // PASO 4 — Tipos de comida
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.perfil.objetivos = ctx.message.text
      .trim()
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    await ctx.reply(
      '¿Qué tipos de cocina o comidas te gustan más?\n\n_Por ejemplo: mediterránea, italiana, asiática, española, etc._',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // PASO 5 — Tiempo por día
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.perfil.tipos_comida = ctx.message.text
      .trim()
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    await ctx.reply(
      '¿Cuánto tiempo tenés para cocinar cada día?\n\n_Podés decirme si varía según el día. Por ejemplo: "entre semana 30 min, fin de semana 1 hora" o "lunes y martes 20 min, resto 45 min"._',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // PASO 6 — Gustos
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.perfil.tiempo_texto = ctx.message.text.trim();
    ctx.wizard.state.perfil.tiempo_por_dia = parsearTiempo(ctx.message.text.trim());

    await ctx.reply(
      '¿Hay comidas o ingredientes que te gusten especialmente?\n\n_Por ejemplo: pasta, pollo, verduras asadas, mariscos, etc._',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // PASO 7 — No gusta / alergias
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.perfil.gustos = ctx.message.text
      .trim()
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    await ctx.reply(
      '¿Hay algo que NO te guste o no puedas comer?\n\n_Alergias, intolerancias, aversiones... Si no hay nada, escribí "ninguno"._',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // PASO 8 — Heladera y despensa
  async (ctx) => {
    if (!ctx.message?.text) return;
    const texto = ctx.message.text.trim().toLowerCase();

    if (texto !== 'ninguno' && texto !== 'nada' && texto !== 'no') {
      const items = texto.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
      // Heurística básica: si mencionan palabras clave de alergias las separamos
      ctx.wizard.state.perfil.no_gusta = items.filter(
        (i) => !['alérgico', 'alergia', 'intolerante', 'intolerancia'].some((k) => i.includes(k))
      );
      ctx.wizard.state.perfil.alergias = items.filter((i) =>
        ['alérgico', 'alergia', 'intolerante', 'intolerancia'].some((k) => i.includes(k))
      );
    } else {
      ctx.wizard.state.perfil.no_gusta = [];
      ctx.wizard.state.perfil.alergias = [];
    }

    await ctx.reply(
      '¡Casi listo! Una última pregunta: ¿qué tenés ahora mismo en la heladera y despensa que quieras aprovechar esta semana?\n\n_Por ejemplo: "huevos, leche, pechuga de pollo, arroz, lentejas". Si no tenés nada en particular, escribí "nada"._',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // PASO FINAL — Guardar y completar
  async (ctx) => {
    if (!ctx.message?.text) return;
    const texto = ctx.message.text.trim().toLowerCase();

    const { heladera, despensa } = parsearHeladera(ctx.message.text.trim());
    ctx.wizard.state.perfil.heladera_actual = heladera;
    ctx.wizard.state.perfil.despensa_actual = despensa;

    // Preguntar Thermomix
    await ctx.reply(
      '¿Tenés Thermomix en casa? Así puedo adaptar las recetas para vos.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Sí, tengo Thermomix ✅', callback_data: 'thermomix_si' },
              { text: 'No, cocino sin Thermomix', callback_data: 'thermomix_no' },
            ],
          ],
        },
      }
    );
    return ctx.wizard.next();
  },

  // PASO FINAL — Recibir respuesta Thermomix y guardar
  async (ctx) => {
    // Manejar tanto callback_query como mensaje de texto
    let tieneThermomix = false;

    if (ctx.callbackQuery) {
      tieneThermomix = ctx.callbackQuery.data === 'thermomix_si';
      await ctx.answerCbQuery();
    } else if (ctx.message?.text) {
      const t = ctx.message.text.toLowerCase();
      tieneThermomix = t.includes('sí') || t.includes('si') || t.includes('s');
    } else {
      return; // Esperar una respuesta válida
    }

    ctx.wizard.state.perfil.tiene_thermomix = tieneThermomix;

    const chatId = ctx.chat.id;
    const perfil = {
      ...ctx.wizard.state.perfil,
      onboarding_completo: true,
    };

    try {
      await guardarUsuario(chatId, perfil);
      console.log(`[Onboarding] Perfil guardado para chat_id ${chatId}`);
    } catch (error) {
      console.error('[Onboarding] Error guardando perfil:', error.message);
      await ctx.reply('Hubo un error guardando tu perfil. Por favor intentá de nuevo con /start.');
      return ctx.scene.leave();
    }

    const thermomixMensaje = tieneThermomix
      ? 'y veo que tenés Thermomix, ¡así que voy a preparar recetas adaptadas para él! 🤖'
      : '¡Perfecto!';

    await ctx.reply(
      `¡Listo, ${perfil.nombre}! Ya tengo todo lo que necesito ${thermomixMensaje}\n\nAhora voy a armar tu menú de la semana... 🧑‍🍳`,
      { parse_mode: 'Markdown' }
    );

    await ctx.scene.leave();

    // Disparar generación de menú automáticamente
    const { generarYEnviarMenu } = require('../handlers/menu');
    await generarYEnviarMenu(ctx, chatId, perfil);
  }
);

/**
 * Parsea texto libre de tiempo disponible y devuelve un mapa por día.
 * Por defecto: 30 minutos si no puede parsear.
 */
function parsearTiempo(texto) {
  const tiempos = {
    lunes: 30,
    martes: 30,
    miercoles: 30,
    jueves: 30,
    viernes: 30,
    sabado: 60,
    domingo: 90,
  };

  const t = texto.toLowerCase();

  // Buscar números seguidos de "min" o "hora"
  const matchesMin = [...t.matchAll(/(\d+)\s*min/g)].map((m) => parseInt(m[1]));
  const matchesHora = [...t.matchAll(/(\d+)\s*hora/g)].map((m) => parseInt(m[1]) * 60);
  const mediaHora = t.includes('media hora') ? [30] : [];

  const todosLosMinutos = [...matchesMin, ...matchesHora, ...mediaHora];

  if (todosLosMinutos.length === 0) return tiempos;

  // Si hay 1 valor, aplicar a todos
  if (todosLosMinutos.length === 1) {
    Object.keys(tiempos).forEach((d) => (tiempos[d] = todosLosMinutos[0]));
    return tiempos;
  }

  // Si hay 2 valores: primero = entresemana, segundo = fin de semana
  const semana = todosLosMinutos[0];
  const finde = todosLosMinutos[1];
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].forEach((d) => (tiempos[d] = semana));
  ['sabado', 'domingo'].forEach((d) => (tiempos[d] = finde));

  return tiempos;
}

/**
 * Parsea texto libre de heladera/despensa en dos listas.
 */
function parsearHeladera(texto) {
  if (!texto || texto.toLowerCase() === 'nada' || texto.toLowerCase() === 'ninguno') {
    return { heladera: [], despensa: [] };
  }

  const items = texto.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

  // Clasificación simplificada: perecederos → heladera, resto → despensa
  const perecederos = ['huevo', 'leche', 'pollo', 'carne', 'pescado', 'verdura', 'fruta', 'queso', 'yogur', 'jamón'];
  const heladera = items.filter((i) => perecederos.some((p) => i.toLowerCase().includes(p)));
  const despensa = items.filter((i) => !perecederos.some((p) => i.toLowerCase().includes(p)));

  return { heladera, despensa };
}

module.exports = { onboardingWizard: paso1, ONBOARDING_SCENE_ID };
