import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'gf_ai_session:v1';

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.messages || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

function newSession() {
  return { id: String(Date.now()), createdAt: Date.now(), messages: [] };
}

function renderInline(text = '') {
  // Mini-markdown seguro (sem HTML): suporta **bold** e `code`.
  // (Não interpretamos *single asterisk* pra evitar negrito “estranho”.)
  const nodes = [];
  let i = 0;
  const pushText = (value) => {
    if (!value) return;
    nodes.push(value);
  };

  while (i < text.length) {
    if (text[i] === '`') {
      const j = text.indexOf('`', i + 1);
      if (j > i) {
        nodes.push(
          <code key={`c-${i}`} className='rounded-lg bg-white/10 px-1.5 py-0.5 text-[0.95em] font-semibold text-slate-100'>
            {text.slice(i + 1, j)}
          </code>
        );
        i = j + 1;
        continue;
      }
    }

    if (text[i] === '*' && text[i + 1] === '*') {
      const j = text.indexOf('**', i + 2);
      if (j > i) {
        nodes.push(
          <strong key={`b-${i}`} className='font-extrabold text-slate-50'>
            {text.slice(i + 2, j)}
          </strong>
        );
        i = j + 2;
        continue;
      }
    }

    const nextSpecial = (() => {
      const a = text.indexOf('`', i);
      const b = text.indexOf('**', i);
      const candidates = [a, b].filter((v) => v !== -1);
      return candidates.length ? Math.min(...candidates) : -1;
    })();
    if (nextSpecial === -1) {
      pushText(text.slice(i));
      break;
    }
    pushText(text.slice(i, nextSpecial));
    i = nextSpecial;
  }

  return nodes;
}

function RichText({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className='space-y-2'>
      {lines.map((line, idx) => (
        <p key={idx} className='leading-relaxed'>
          {renderInline(line)}
        </p>
      ))}
    </div>
  );
}

export default function Ai({ api }) {
  const [session, setSession] = useState(() => loadSession() || newSession());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const messages = session?.messages || [];

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, loading]);

  const canSend = useMemo(() => !loading && input.trim().length > 0, [loading, input]);

  const startNew = () => {
    const fresh = newSession();
    setSession(fresh);
    setInput('');
    setLoading(false);
  };

  const send = async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');

    const next = {
      ...session,
      messages: [...messages, { role: 'user', content: text, at: Date.now() }],
    };
    setSession(next);
    setLoading(true);

    try {
      const history = next.messages
        .filter((m) => m?.role === 'user' || m?.role === 'assistant')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await api('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      });

      setSession((cur) => ({
        ...cur,
        messages: [...(cur.messages || []), { role: 'assistant', content: resp?.answer || 'Não consegui responder agora.', at: Date.now() }],
      }));
    } catch (e) {
      setSession((cur) => ({
        ...cur,
        messages: [...(cur.messages || []), { role: 'assistant', content: `Deu erro aqui: ${e.message}`, at: Date.now() }],
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-[calc(100dvh-12.5rem)] flex-col gap-4'>
      <header className='flex items-end justify-between gap-3 px-1'>
        <div className='min-w-0'>
          <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Assistente</p>
          <h1 className='truncate text-2xl font-bold text-slate-100'>Nicco IA</h1>
          <p className='mt-1 text-sm text-slate-400'>Pergunta qualquer coisa sobre seus números e transações.</p>
        </div>
        <button type='button' onClick={startNew} className='icon-btn' aria-label='Nova conversa'>
          <Trash2 size={18} />
        </button>
      </header>

      {/* Chat: área principal + barra de input fixa dentro da página */}
      <section className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-4xl border border-white/10 bg-[rgba(10,10,16,0.70)] shadow-soft'>
        <div ref={listRef} className='min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4'>
          {messages.length === 0 ? (
            <div className='rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300'>
              Me pergunta tipo: “quanto gastei por categoria?”, “qual conta mais saiu dinheiro?”, “o que tá pesando esse mês?”.
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={`${m.at || idx}-${idx}`} className='space-y-1.5'>
                <p className='text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500'>
                  {m.role === 'user' ? 'Você' : 'Nicco IA'}
                </p>
                <div className='rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200'>
                  <RichText text={m.content} />
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className='space-y-1.5'>
              <p className='text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500'>Nicco IA</p>
              <div className='rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400'>Pensando…</div>
            </div>
          )}
        </div>

        <div className='border-t border-white/10 bg-[rgba(6,6,10,0.82)] px-4 py-3'>
          <div className='flex items-end gap-2'>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder='Pergunta pro Nicco IA…'
              className='min-h-[52px] flex-1 resize-none rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 shadow-soft outline-none placeholder:text-slate-500 focus:border-white/20'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type='button'
              onClick={send}
              disabled={!canSend}
              className='grid h-12 w-12 place-items-center rounded-full bg-[rgba(231,220,198,0.92)] text-black shadow-soft transition disabled:opacity-40'
              aria-label='Enviar'
            >
              <Send size={18} />
            </button>
          </div>
          <p className='mt-2 text-[11px] text-slate-500'>Enter envia · Shift+Enter quebra linha</p>
        </div>
      </section>
    </div>
  );
}
