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
    <div className='space-y-4'>
      <header className='flex items-end justify-between gap-3 px-1'>
        <div className='min-w-0'>
          <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Assistente</p>
          <h1 className='truncate text-2xl font-bold text-slate-900'>Nicco IA</h1>
          <p className='mt-1 text-sm text-slate-500'>Pergunta qualquer coisa sobre seus números e transações.</p>
        </div>
        <button type='button' onClick={startNew} className='icon-btn' aria-label='Nova conversa'>
          <Trash2 size={18} />
        </button>
      </header>

      <section className='rounded-4xl bg-white p-4 shadow-soft'>
        <div ref={listRef} className='max-h-[55vh] space-y-3 overflow-auto px-1 py-2'>
          {messages.length === 0 ? (
            <div className='rounded-3xl bg-slate-50 p-4 text-sm text-slate-600'>
              Me pergunta tipo: “quanto gastei por categoria?”, “qual conta mais saiu dinheiro?”, “o que tá pesando esse mês?”.
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={`${m.at || idx}-${idx}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm shadow-soft ${m.role === 'user' ? 'bg-slate-900 text-slate-50' : 'bg-slate-50 text-slate-800'}`}>
                  {m.content}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className='flex justify-start'>
              <div className='rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-500 shadow-soft'>Pensando…</div>
            </div>
          )}
        </div>

        <div className='mt-3 flex items-end gap-2'>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder='Pergunta pro Nicco IA…'
            className='min-h-[48px] flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-soft outline-none focus:border-indigo-300'
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
            className='grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-white shadow-soft transition disabled:opacity-40'
            aria-label='Enviar'
          >
            <Send size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
