const { GoogleGenerativeAI } = require('@google/generative-ai');

const TIMEOUT_MS = 30000;
const MAX_REINTENTOS = 2;

let clienteGemini;

function obtenerCliente() {
  if (!clienteGemini) {
    clienteGemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return clienteGemini;
}

async function llamarGemini(prompt, systemPrompt) {
  const cliente = obtenerCliente();
  const modelo = cliente.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  });

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resultado = await modelo.generateContent(prompt);
    clearTimeout(timer);
    return resultado.response.text();
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

async function llamarGeminiConReintentos(prompt, systemPrompt) {
  let ultimoError;
  for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
    try {
      const respuesta = await llamarGemini(prompt, systemPrompt);
      console.log(`[Gemini] Respuesta obtenida en intento ${intento}`);
      return respuesta;
    } catch (error) {
      ultimoError = error;
      console.warn(`[Gemini] Intento ${intento} fallido: ${error.message}`);
      if (intento < MAX_REINTENTOS) {
        await new Promise((r) => setTimeout(r, 1000 * intento));
      }
    }
  }
  throw ultimoError;
}

module.exports = { llamarGeminiConReintentos };
