const OpenAI = require('openai');

const TIMEOUT_MS = 45000;
const MAX_OUTPUT_TOKENS = 8192;

let clienteOpenAI;

function tieneOpenAIApiKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function obtenerCliente() {
  if (!tieneOpenAIApiKey()) {
    throw new Error('OPENAI_API_KEY no configurada');
  }
  if (!clienteOpenAI) {
    clienteOpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY.trim(),
      timeout: TIMEOUT_MS,
    });
  }
  return clienteOpenAI;
}

async function llamarOpenAI(prompt, systemPrompt, opciones = {}) {
  const { jsonMode = false } = opciones;
  const cliente = obtenerCliente();

  const params = {
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: MAX_OUTPUT_TOKENS,
  };

  if (jsonMode) {
    params.response_format = { type: 'json_object' };
  }

  const respuesta = await cliente.chat.completions.create(params);
  const contenido = respuesta.choices[0]?.message?.content;
  if (!contenido?.trim()) {
    throw new Error('OpenAI devolvió respuesta vacía');
  }
  if (respuesta.choices[0]?.finish_reason === 'length') {
    throw new Error('OpenAI truncó la respuesta (límite de tokens)');
  }
  return contenido;
}

module.exports = { llamarOpenAI, tieneOpenAIApiKey };
