/**
 * Formatea recetas al estilo Thermomix TM6 para Telegram (MarkdownV2).
 */

const { escapeMarkdownV2 } = require('./telegram');

const ICONOS_FUNCION = {
  normal: '🔄',
  Varoma: '♨️',
  mariposa: '🦋',
  inverso: '↩️',
  turbo: '⚡',
};

function formatearConfigThermomix(config) {
  if (!config) return '';

  const partes = [];
  if (config.temperatura) partes.push(`🌡️ ${escapeMarkdownV2(config.temperatura)}`);
  if (config.tiempo) partes.push(`⏱️ ${escapeMarkdownV2(config.tiempo)}`);
  if (config.velocidad) partes.push(`💨 Vel\\. ${escapeMarkdownV2(config.velocidad)}`);
  if (config.funcion && config.funcion !== 'normal') {
    const icono = ICONOS_FUNCION[config.funcion] || '🔄';
    partes.push(`${icono} ${escapeMarkdownV2(config.funcion)}`);
  }

  return partes.join(' \\| ');
}

function formatearPaso(paso, tieneThermomix) {
  let texto = `*Paso ${paso.numero}*\n${escapeMarkdownV2(paso.instruccion)}`;

  if (tieneThermomix && !paso.sin_thermomix && paso.thermomix_config) {
    const config = formatearConfigThermomix(paso.thermomix_config);
    if (config) {
      texto += `\n${config}`;
    }
  } else if (tieneThermomix && paso.sin_thermomix) {
    texto += '\n_\\(Sin Thermomix\\)_';
  }

  return texto;
}

function formatearReceta(receta, tieneThermomix) {
  const lineas = [];

  const modelo = tieneThermomix ? 'Thermomix TM6' : 'Receta tradicional';
  lineas.push(`🍽️ *${escapeMarkdownV2(receta.nombre.toUpperCase())}*`);
  lineas.push(
    `👥 ${receta.porciones} personas \\| ⏱️ ${receta.tiempo_total} minutos \\| _${escapeMarkdownV2(modelo)}_`
  );
  lineas.push('');

  lineas.push('📋 *INGREDIENTES*');
  for (const ing of receta.ingredientes) {
    lineas.push(`\\- ${escapeMarkdownV2(ing.nombre)} — ${escapeMarkdownV2(ing.cantidad)}`);
  }
  lineas.push('');

  const tituloMetodo = tieneThermomix ? '👨‍🍳 *PASOS \\(Thermomix TM6\\)*' : '👨‍🍳 *PASOS*';
  lineas.push(tituloMetodo);
  for (const paso of receta.pasos) {
    lineas.push('');
    lineas.push(formatearPaso(paso, tieneThermomix));
  }

  if (receta.notas) {
    lineas.push('');
    lineas.push('📝 *NOTAS*');
    lineas.push(escapeMarkdownV2(receta.notas));
  }

  lineas.push('');
  lineas.push('─────────────────────');
  if (tieneThermomix) {
    const nombreEncoded = encodeURIComponent(receta.nombre);
    lineas.push('🔍 *¿Querés la versión oficial de Cookidoo?*');
    lineas.push(`Buscá "${escapeMarkdownV2(receta.nombre)}" en Cookidoo:`);
    lineas.push(`https://cookidoo.es/search?query=${nombreEncoded}`);
    lineas.push(
      '💡 _Si la encontrás, la versión de Cookidoo puede tener pasos optimizados para tu modelo\\._'
    );
  }

  return lineas.join('\n');
}

function generarIdReceta(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

module.exports = {
  formatearReceta,
  generarIdReceta,
  formatearConfigThermomix,
};
