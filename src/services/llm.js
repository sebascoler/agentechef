const { llamarGeminiConReintentos } = require('./gemini');
const { llamarOpenAI } = require('./openai');

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

async function llamarLLM(prompt, systemPrompt) {
  const system = systemPrompt || SYSTEM_PROMPT_BASE;

  try {
    const respuesta = await llamarGeminiConReintentos(prompt, system);
    console.log('[LLM] Usando Gemini');
    return respuesta;
  } catch (errorGemini) {
    console.error('[LLM] Gemini falló, haciendo fallback a OpenAI:', errorGemini.message);
    try {
      const respuesta = await llamarOpenAI(prompt, system);
      console.log('[LLM] Usando OpenAI (fallback)');
      return respuesta;
    } catch (errorOpenAI) {
      console.error('[LLM] OpenAI también falló:', errorOpenAI.message);
      throw new Error('Todos los proveedores de IA fallaron. Por favor intenta de nuevo en unos minutos.');
    }
  }
}

module.exports = { llamarLLM, SYSTEM_PROMPT_BASE };
