const { GoogleGenerativeAI } = require('@google/generative-ai');

const TIMEOUT_MS = 45000;
const MAX_REINTENTOS_POR_MODELO = 2;
const MAX_OUTPUT_TOKENS = 8192;

// Orden: más rápido primero. gemini-flash-latest sigue el alias estable de Google.
const MODELOS_GEMINI_DEFECTO = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

function tieneGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function modelosGemini() {
  const preferido = process.env.GEMINI_MODEL?.trim();
  const lista = preferido ? [preferido, ...MODELOS_GEMINI_DEFECTO] : [...MODELOS_GEMINI_DEFECTO];
  return [...new Set(lista)];
}

let clienteGemini;

function obtenerCliente() {
  if (!tieneGeminiApiKey()) {
    throw new Error('GEMINI_API_KEY no configurada');
  }
  if (!clienteGemini) {
    clienteGemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  }
  return clienteGemini;
}

function esErrorReintentable(error) {
  const msg = error.message || '';
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('UNAVAILABLE')
  );
}

async function llamarGeminiConModelo(modelName, prompt, systemPrompt) {
  const cliente = obtenerCliente();
  const modelo = cliente.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  const resultado = await modelo.generateContent(prompt);
  const texto = resultado.response.text();
  if (!texto?.trim()) {
    throw new Error('Gemini devolvió respuesta vacía');
  }
  return texto;
}

async function llamarGemini(prompt, systemPrompt) {
  const modelos = modelosGemini();
  let ultimoError;

  for (const modelName of modelos) {
    for (let intento = 1; intento <= MAX_REINTENTOS_POR_MODELO; intento++) {
      try {
        const respuesta = await llamarGeminiConModelo(modelName, prompt, systemPrompt);
        console.log(`[Gemini] OK modelo=${modelName} intento=${intento}`);
        return respuesta;
      } catch (error) {
        ultimoError = error;
        const reintentable = esErrorReintentable(error);
        console.warn(
          `[Gemini] Fallo modelo=${modelName} intento=${intento}: ${error.message?.slice(0, 160)}`
        );
        if (reintentable && intento < MAX_REINTENTOS_POR_MODELO) {
          await new Promise((r) => setTimeout(r, 1000 * intento));
          continue;
        }
        break;
      }
    }
  }

  throw ultimoError;
}

async function llamarGeminiConReintentos(prompt, systemPrompt) {
  return llamarGemini(prompt, systemPrompt);
}

module.exports = {
  llamarGeminiConReintentos,
  tieneGeminiApiKey,
  modelosGemini,
};
