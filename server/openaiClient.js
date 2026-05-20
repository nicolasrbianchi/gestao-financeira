import { logger } from './logger.js';

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

function pickTextFromResponsesJson(json) {
  if (!json) return null;
  if (typeof json.output_text === 'string' && json.output_text.trim()) return json.output_text;
  // Fallback: tenta achar conteúdo em output[]
  const chunks = [];
  for (const item of json.output || []) {
    for (const part of item.content || []) {
      if (part.type === 'output_text' && typeof part.text === 'string') chunks.push(part.text);
      if (part.type === 'text' && typeof part.text === 'string') chunks.push(part.text);
    }
  }
  const joined = chunks.join('\n').trim();
  return joined || null;
}

function pickTextFromChatCompletionsJson(json) {
  const text = json?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text : null;
}

export async function openAiText({ apiKey, requestId, model, messages, maxOutputTokens = 900 }) {
  if (!apiKey) throw new Error('OPENAI_KEY não configurada.');

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // 1) Tenta Responses API
  try {
    const body = {
      model,
      input: messages.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: maxOutputTokens,
    };

    const r = await fetch(`${OPENAI_BASE_URL}/responses`, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(json?.error?.message || `OpenAI /responses HTTP ${r.status}`);
    }
    const text = pickTextFromResponsesJson(json);
    if (!text) throw new Error('OpenAI /responses retornou vazio.');
    return { ok: true, text, raw: { id: json.id || null, usage: json.usage || null } };
  } catch (error) {
    logger.warn('openai_responses_failed', { requestId, error: error.message });
  }

  // 2) Fallback: Chat Completions
  const body = {
    model,
    messages,
    max_tokens: maxOutputTokens,
    temperature: 0.2,
  };

  const r = await fetch(`${OPENAI_BASE_URL}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error?.message || `OpenAI /chat/completions HTTP ${r.status}`);
  const text = pickTextFromChatCompletionsJson(json);
  if (!text) throw new Error('OpenAI /chat/completions retornou vazio.');
  return { ok: true, text, raw: { id: json.id || null, usage: json.usage || null } };
}

