// Lightweight LLM provider wrapper with safety guardrails
// Providers supported: Mistral (preferred), OpenRouter, Hugging Face Inference API

const SAFE_BLOCK_TEXT = 'Sorry, I can\'t assist with that.';

function isBlockedPrompt(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  // Very simple keyword screens aligned to app safety policy
  const blocked = [
    'kill', 'murder', 'violence', 'bomb', 'terror', 'racist', 'sexist', 'hate',
    'porn', 'sexual', 'nsfw', 'rape', 'abuse', 'self-harm', 'suicide'
  ];
  return blocked.some(k => t.includes(k));
}

async function callOpenRouter(messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
  const payload = {
    model,
    messages,
    temperature: 0.3,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return content || null;
}

async function callMistral(messages) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return null;
  const endpoint = 'https://api.mistral.ai/v1/chat/completions';
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  const payload = {
    model,
    messages,
    temperature: 0.3,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return content || null;
}

async function callHuggingFace(prompt) {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) return null;
  const model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct';
  const endpoint = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
  const payload = {
    inputs: prompt,
    parameters: {
      max_new_tokens: 200,
      temperature: 0.3,
      return_full_text: false
    }
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  return text || null;
}

async function queryLLM(userMessage, options = {}) {
  if (isBlockedPrompt(userMessage)) return SAFE_BLOCK_TEXT;

  const knowledgeContext = String(options.knowledgeContext || '').trim();
  const supportContact = String(options.supportContact || 'support@modernpedagogues.com').trim();
  const intents = Array.isArray(options.intents) ? options.intents : [];
  const history = Array.isArray(options.history) ? options.history : [];
  const contextBlock = knowledgeContext
    ? `Use this verified site context when answering client questions:\n${knowledgeContext}`
    : 'No extra site context provided. Use best effort and avoid fabricating specifics.';
  const historyBlock = history.length
    ? history.map(item => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${String(item.content || '').trim()}`).join('\n')
    : 'No prior messages.';

  const system = {
    role: 'system',
    content: `You are a friendly client support + tutoring assistant for The Modern Pedagogues.
Answer helpfully, clearly, and safely.
Prioritize answering client concerns about tutors, lessons, pricing, bookings, account access, downloads, curriculum, safety, and policies.
Active intents for this user message: ${intents.join(', ') || 'general_support'}.
Use up to 3 short bullet points, then 1 short next-step sentence.
When details are uncertain, say what is known and direct the user to /contact or ${supportContact}.
Never invent specific prices, policies, or promises not supported by provided context.
If asked for anything harmful, hateful, racist, sexist, lewd, or violent, respond strictly with: "Sorry, I can't assist with that."

${contextBlock}

Recent conversation:
${historyBlock}`
  };
  const user = { role: 'user', content: String(userMessage || '') };
  const priorMessages = history
    .map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '').trim()
    }))
    .filter(item => item.content)
    .slice(-6);
  const messages = [system, ...priorMessages, user];

  // Prefer Mistral if configured
  if (process.env.MISTRAL_API_KEY) {
    const ans = await callMistral(messages);
    if (ans) return ans;
  }

  // Next preference: OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const ans = await callOpenRouter(messages);
    if (ans) return ans;
  }

  // Fallback to Hugging Face if available
  if (process.env.HUGGINGFACE_API_KEY) {
    const prompt = `${system.content}\n\n${priorMessages.map(item => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`).join('\n')}\nUser: ${user.content}\nAssistant:`;
    const ans = await callHuggingFace(prompt);
    if (ans) return ans;
  }

  // No provider configured
  return null;
}

module.exports = {
  queryLLM,
  isBlockedPrompt,
  SAFE_BLOCK_TEXT,
  // export for tests or future use
  callMistral,
  callOpenRouter,
};
