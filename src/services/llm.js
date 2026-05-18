const { llamarGeminiConReintentos, tieneGeminiApiKey } = require('./gemini');
const { llamarOpenAI, tieneOpenAIApiKey } = require('./openai');
const { parsearJSON, normalizarMenu } = require('../utils/parser');

const SYSTEM_PROMPT_BASE = `Eres un asistente experto en planificación de menús semanales para familias.
Hablas en español de Argentina (tuteo, no voseo).
Eres práctico, cercano y útil. Nunca eres genérico: tus sugerencias son concretas y adaptadas al usuario.
Tienes en cuenta el tiempo disponible, los gustos, las restricciones y lo que hay en casa.
Cuando generes recetas para Thermomix TM6, usa el formato estándar:
- Temperatura en °C (máximo 160°C) o "Varoma" para cocción al vapor
- Velocidad del 1 al 10, o "Turbo"
- Tiempo en minutos
- Función: normal, Varoma, mariposa (para montar nata/claras), inverso (para alimentos delicados)
IMPORTANTE: Cuando se te pida JSON, responde ÚNICAMENTE con JSON válido.
Sin markdown, sin bloques de código, sin explicaciones adicionales. Solo el JSON puro.`;

const REFUERZO_JSON =
  '\n\nOBLIGATORIO: el objeto "dias" debe incluir exactamente estas 7 claves sin acentos: lunes, martes, miercoles, jueves, viernes, sabado, domingo. Cada día con "almuerzo" y "cena", cada comida con "nombre" y "tiempo_estimado" (número).';

function requiereJson(prompt, systemPrompt) {
  const texto = `${prompt} ${systemPrompt || ''}`.toLowerCase();
  return texto.includes('json') || texto.includes('únicamente con');
}

async function llamarLLM(prompt, systemPrompt, opciones = {}) {
  const system = systemPrompt || SYSTEM_PROMPT_BASE;
  const jsonMode = opciones.jsonMode ?? requiereJson(prompt, system);
  const errores = [];

  if (tieneGeminiApiKey()) {
    try {
      const respuesta = await llamarGeminiConReintentos(prompt, system);
      console.log('[LLM] Proveedor: Gemini');
      return respuesta;
    } catch (errorGemini) {
      errores.push(`Gemini: ${errorGemini.message}`);
      console.error('[LLM] Gemini falló:', errorGemini.message);
    }
  } else {
    console.warn('[LLM] GEMINI_API_KEY no configurada, se omite Gemini');
  }

  if (tieneOpenAIApiKey()) {
    try {
      const respuesta = await llamarOpenAI(prompt, system, { jsonMode });
      console.log('[LLM] Proveedor: OpenAI (fallback)');
      return respuesta;
    } catch (errorOpenAI) {
      errores.push(`OpenAI: ${errorOpenAI.message}`);
      console.error('[LLM] OpenAI falló:', errorOpenAI.message);
    }
  } else {
    console.warn('[LLM] OPENAI_API_KEY no configurada, se omite OpenAI');
  }

  if (!tieneGeminiApiKey() && !tieneOpenAIApiKey()) {
    throw new Error('No hay API keys de IA configuradas (GEMINI_API_KEY u OPENAI_API_KEY).');
  }

  throw new Error(
    errores.length
      ? `Todos los proveedores de IA fallaron. ${errores.join(' | ')}`
      : 'Todos los proveedores de IA fallaron. Por favor intenta de nuevo en unos minutos.'
  );
}

async function llamarLLMConJSON(prompt, systemPrompt, validarFn, maxIntentos = 3) {
  const system = systemPrompt || SYSTEM_PROMPT_BASE;
  let ultimoError;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    const promptIntento = intento === 1 ? prompt : `${prompt}${REFUERZO_JSON}`;
    try {
      const respuesta = await llamarLLM(promptIntento, system, { jsonMode: true });
      const datos = normalizarMenu(parsearJSON(respuesta));
      validarFn(datos);
      return datos;
    } catch (error) {
      ultimoError = error;
      console.warn(`[LLM] Intento JSON ${intento}/${maxIntentos} falló: ${error.message}`);
    }
  }

  throw ultimoError;
}

module.exports = {
  llamarLLM,
  llamarLLMConJSON,
  SYSTEM_PROMPT_BASE,
  tieneGeminiApiKey,
  tieneOpenAIApiKey,
};
