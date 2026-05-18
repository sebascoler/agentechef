const OpenAI = require('openai');

const TIMEOUT_MS = 30000;

let clienteOpenAI;

function obtenerCliente() {
  if (!clienteOpenAI) {
    clienteOpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: TIMEOUT_MS,
    });
  }
  return clienteOpenAI;
}

async function llamarOpenAI(prompt, systemPrompt) {
  const cliente = obtenerCliente();
  const respuesta = await cliente.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });
  return respuesta.choices[0].message.content;
}

module.exports = { llamarOpenAI };
