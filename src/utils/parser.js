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

const DIAS_MENU = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const ALIAS_DIAS = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miercoles',
  miércoles: 'miercoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sabado',
  sábado: 'sabado',
  domingo: 'domingo',
};

function quitarAcentos(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizarMenu(datos) {
  if (!datos || typeof datos !== 'object') {
    throw new Error('El menú no es un objeto válido');
  }

  if (!datos.dias || typeof datos.dias !== 'object') {
    throw new Error('El menú no contiene campo "dias"');
  }

  const diasNormalizados = {};
  for (const [clave, valor] of Object.entries(datos.dias)) {
    const claveLimpia = quitarAcentos(String(clave).trim().toLowerCase());
    const diaCanonico = ALIAS_DIAS[claveLimpia] || ALIAS_DIAS[clave.trim().toLowerCase()];
    if (diaCanonico) {
      diasNormalizados[diaCanonico] = valor;
    }
  }

  return { ...datos, dias: diasNormalizados };
}

function validarMenu(datos) {
  const normalizado = normalizarMenu(datos);
  if (!normalizado.dias) throw new Error('El menú no contiene campo "dias"');

  for (const dia of DIAS_MENU) {
    if (!normalizado.dias[dia]) throw new Error(`Falta el día "${dia}" en el menú`);
    if (!normalizado.dias[dia].almuerzo?.nombre) {
      throw new Error(`Falta almuerzo válido en "${dia}"`);
    }
    if (!normalizado.dias[dia].cena?.nombre) {
      throw new Error(`Falta cena válida en "${dia}"`);
    }
  }
  return normalizado;
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
  normalizarMenu,
  validarMenu,
  validarListaCompra,
  validarReceta,
  DIAS_MENU,
};
