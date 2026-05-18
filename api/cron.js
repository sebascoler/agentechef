require('dotenv').config();

const { inicializarFirebase, obtenerTodosLosUsuarios, obtenerMenu } = require('../src/services/firebase');
const { enviarMensajeTelegram } = require('../src/services/scheduler');
const {
  semanaISOActual,
  diaSemanaEnMadrid,
  fechaDeHoyFormateada,
} = require('../src/utils/dateHelper');

inicializarFirebase();

function escapeMarkdown(texto) {
  if (!texto) return '';
  return String(texto).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function construirMensajeHoy(perfil, diaData, listaCompra) {
  const nombre = perfil.nombre || 'amigo';
  const diaActual = diaSemanaEnMadrid();
  const fechaHoy = fechaDeHoyFormateada();
  const nombreDiaCapitalizado = diaActual.charAt(0).toUpperCase() + diaActual.slice(1);

  const almuerzo = diaData.almuerzo?.nombre || 'No definido';
  const cena = diaData.cena?.nombre || 'No definido';
  const tiempoAlmuerzo = diaData.almuerzo?.tiempo_estimado;
  const tiempoCena = diaData.cena?.tiempo_estimado;

  const lineas = [
    `☀️ *¡Buenos días, ${escapeMarkdown(nombre)}\\!*`,
    ``,
    `🍽️ *Tu menú de hoy — ${escapeMarkdown(nombreDiaCapitalizado)} ${escapeMarkdown(fechaHoy)}*`,
    ``,
    `🌞 Almuerzo: ${escapeMarkdown(almuerzo)}${tiempoAlmuerzo ? ` \\(⏱️ ~${tiempoAlmuerzo} min\\)` : ''}`,
    `🌙 Cena: ${escapeMarkdown(cena)}${tiempoCena ? ` \\(⏱️ ~${tiempoCena} min\\)` : ''}`,
  ];

  // Ingredientes relevantes de la lista de compra
  if (listaCompra?.items && listaCompra.items.length > 0) {
    const muestra = listaCompra.items.slice(0, 4);
    lineas.push('');
    lineas.push('🛒 *Recordatorio de compra*');
    lineas.push('Para hoy puede que necesités:');
    muestra.forEach((i) => {
      lineas.push(`\\- ${escapeMarkdown(i.ingrediente)} — ${escapeMarkdown(i.cantidad)}`);
    });
  }

  lineas.push('');
  lineas.push('Escribí /recetas para ver las recetas completas 👨‍🍳');

  return lineas.join('\n');
}

function construirMensajeSinMenu(nombre) {
  return `¡Buenos días ${escapeMarkdown(nombre || 'amigo')}\\! Aún no tenés menú para esta semana\\. Escribí /menu para armar uno 📅`;
}

async function procesarUsuario(perfil) {
  const chatId = perfil.chat_id;
  const nombre = perfil.nombre || 'amigo';

  try {
    const semana = semanaISOActual();
    const menu = await obtenerMenu(chatId, semana);

    if (!menu || menu.estado !== 'confirmado') {
      const mensaje = construirMensajeSinMenu(nombre);
      await enviarMensajeTelegram(chatId, mensaje);
      console.log(`[Cron] ✅ Enviado sin-menú a ${chatId} (${nombre})`);
      return { chatId, estado: 'sin_menu' };
    }

    const diaActual = diaSemanaEnMadrid();
    const diaData = menu.dias[diaActual];

    if (!diaData) {
      console.warn(`[Cron] Sin datos para hoy (${diaActual}) en menú de ${chatId}`);
      return { chatId, estado: 'sin_dia' };
    }

    const mensaje = construirMensajeHoy(perfil, diaData, menu.lista_compra);
    await enviarMensajeTelegram(chatId, mensaje);
    console.log(`[Cron] ✅ Notificación enviada a ${chatId} (${nombre})`);
    return { chatId, estado: 'ok' };
  } catch (error) {
    console.error(`[Cron] ❌ Error para ${chatId} (${nombre}):`, error.message);
    return { chatId, estado: 'error', error: error.message };
  }
}

// Handler del endpoint Vercel
module.exports = async (req, res) => {
  // Verificar que es una llamada legítima de Vercel Cron
  const authHeader = req.headers.authorization;
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.warn('[Cron] Acceso no autorizado');
    return res.status(401).json({ error: 'No autorizado' });
  }

  console.log('[Cron] Iniciando envío de notificaciones diarias...');
  const inicio = Date.now();

  let usuarios = [];
  try {
    usuarios = await obtenerTodosLosUsuarios();
    console.log(`[Cron] Procesando ${usuarios.length} usuario(s)`);
  } catch (error) {
    console.error('[Cron] Error obteniendo usuarios:', error.message);
    return res.status(500).json({ error: 'Error obteniendo usuarios' });
  }

  if (usuarios.length === 0) {
    return res.status(200).json({ ok: true, enviados: 0, duracion_ms: Date.now() - inicio });
  }

  // Procesar en paralelo (con límite para no sobrecargar)
  const LOTE = 10;
  const resultados = [];

  for (let i = 0; i < usuarios.length; i += LOTE) {
    const lote = usuarios.slice(i, i + LOTE);
    const resultadosLote = await Promise.allSettled(lote.map(procesarUsuario));
    resultados.push(...resultadosLote.map((r) => (r.status === 'fulfilled' ? r.value : { estado: 'error' })));
  }

  const resumen = {
    ok: true,
    total: resultados.length,
    enviados: resultados.filter((r) => r.estado === 'ok').length,
    sin_menu: resultados.filter((r) => r.estado === 'sin_menu').length,
    errores: resultados.filter((r) => r.estado === 'error').length,
    duracion_ms: Date.now() - inicio,
  };

  console.log('[Cron] Finalizado:', JSON.stringify(resumen));
  return res.status(200).json(resumen);
};
