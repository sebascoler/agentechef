/**
 * Parsea y valida respuestas JSON del LLM.
 * Intenta extraer JSON aunque venga envuelto en markdown u otro texto.
 */

function limpiarJSON(texto) {
  if (!texto) return null;

  let limpio = texto.trim();

  // Eliminar bloques de código markdown: ```json ... ``` o ``` ... ```
  limpio = limpio.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  // Si hay texto antes del primer { o [, cortarlo
  const inicioObjeto = limpio.indexOf('{');
  const inicioArray = limpio.indexOf('[');

  let inicio = -1;
  if (inicioObjeto !== -1 && inicioArray !== -1) {
    inicio = Math.min(inicioObjeto, inicioArray);
  } else if (inicioObjeto !== -1) {
    inicio = inicioObjeto;
  } else if (inicioArray !== -1) {
    inicio = inicioArray;
  }

  if (inicio > 0) {
    limpio = limpio.substring(inicio);
  }

  // Cortar texto después del último } o ]
  const cierreObjeto = limpio.lastIndexOf('}');
  const cierreArray = limpio.lastIndexOf(']');
  const fin = Math.max(cierreObjeto, cierreArray);

  if (fin !== -1 && fin < limpio.length - 1) {
    limpio = limpio.substring(0, fin + 1);
  }

  return limpio;
}

function parsearJSON(texto) {
  if (!texto) {
    throw new Error('Respuesta vacía del LLM');
  }

  // Intento directo
  try {
    return JSON.parse(texto);
  } catch {
    // Continuar con limpieza
  }

  // Intento con limpieza
  const limpio = limpiarJSON(texto);
  if (!limpio) {
    throw new Error('No se pudo extraer JSON de la respuesta');
  }

  try {
    return JSON.parse(limpio);
  } catch (error) {
    console.error('[Parser] JSON inválido después de limpieza:', limpio.substring(0, 200));
    throw new Error(`JSON inválido en respuesta del LLM: ${error.message}`);
  }
}

function validarMenu(datos) {
  const diasEsperados = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  if (!datos.dias) throw new Error('El menú no contiene campo "dias"');

  for (const dia of diasEsperados) {
    if (!datos.dias[dia]) throw new Error(`Falta el día "${dia}" en el menú`);
    if (!datos.dias[dia].almuerzo) throw new Error(`Falta almuerzo en "${dia}"`);
    if (!datos.dias[dia].cena) throw new Error(`Falta cena en "${dia}"`);
  }
  return true;
}

function validarListaCompra(datos) {
  if (!datos.items || !Array.isArray(datos.items)) {
    throw new Error('La lista de compra no contiene campo "items" válido');
  }
  return true;
}

function validarReceta(datos) {
  if (!datos.nombre) throw new Error('La receta no tiene nombre');
  if (!datos.ingredientes || !Array.isArray(datos.ingredientes)) {
    throw new Error('La receta no tiene ingredientes válidos');
  }
  if (!datos.pasos || !Array.isArray(datos.pasos)) {
    throw new Error('La receta no tiene pasos válidos');
  }
  return true;
}

module.exports = {
  parsearJSON,
  validarMenu,
  validarListaCompra,
  validarReceta,
};
