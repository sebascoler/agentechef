/**
 * Formatea recetas al estilo Thermomix TM6 para Telegram (Markdown).
 */

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
  if (config.temperatura) partes.push(`🌡️ ${config.temperatura}`);
  if (config.tiempo) partes.push(`⏱️ ${config.tiempo}`);
  if (config.velocidad) partes.push(`💨 Vel. ${config.velocidad}`);
  if (config.funcion && config.funcion !== 'normal') {
    const icono = ICONOS_FUNCION[config.funcion] || '🔄';
    partes.push(`${icono} ${config.funcion}`);
  }

  return partes.join(' | ');
}

function formatearPaso(paso, tieneThermomix) {
  let texto = `*Paso ${paso.numero}*\n${paso.instruccion}`;

  if (tieneThermomix && !paso.sin_thermomix && paso.thermomix_config) {
    const config = formatearConfigThermomix(paso.thermomix_config);
    if (config) {
      texto += `\n${config}`;
    }
  } else if (tieneThermomix && paso.sin_thermomix) {
    texto += '\n_(Sin Thermomix)_';
  }

  return texto;
}

function formatearReceta(receta, tieneThermomix) {
  const lineas = [];

  const modelo = tieneThermomix ? 'Thermomix TM6' : 'Receta tradicional';
  lineas.push(`🍽️ *${receta.nombre.toUpperCase()}*`);
  lineas.push(`👥 ${receta.porciones} personas | ⏱️ ${receta.tiempo_total} minutos | _${modelo}_`);
  lineas.push('');

  // Ingredientes
  lineas.push('📋 *INGREDIENTES*');
  for (const ing of receta.ingredientes) {
    lineas.push(`\\- ${ing.nombre} — ${ing.cantidad}`);
  }
  lineas.push('');

  // Pasos
  const tituloMetodo = tieneThermomix ? '👨‍🍳 *PASOS \\(Thermomix TM6\\)*' : '👨‍🍳 *PASOS*';
  lineas.push(tituloMetodo);
  for (const paso of receta.pasos) {
    lineas.push('');
    lineas.push(formatearPaso(paso, tieneThermomix));
  }

  // Notas
  if (receta.notas) {
    lineas.push('');
    lineas.push(`📝 *NOTAS*`);
    lineas.push(receta.notas);
  }

  // Link Cookidoo
  lineas.push('');
  lineas.push('─────────────────────');
  if (tieneThermomix) {
    const nombreEncoded = encodeURIComponent(receta.nombre);
    lineas.push(`🔍 *¿Querés la versión oficial de Cookidoo?*`);
    lineas.push(`Buscá "${receta.nombre}" en Cookidoo:`);
    lineas.push(`https://cookidoo.es/search?query=${nombreEncoded}`);
    lineas.push(`💡 _Si la encontrás, la versión de Cookidoo puede tener pasos optimizados para tu modelo\\._`);
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
