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

function ChatBubble({ role, children }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[92%] rounded-4xl bg-white/5 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10'
            : 'max-w-[92%] rounded-4xl bg-[rgba(10,10,16,0.85)] px-4 py-3 text-sm text-slate-100 ring-1 ring-white/10'
        }
      >
        {children}
      </div>
    </div>
  );
}

export default function Ai({ api, resetKey = 0 }) {
  const [session, setSession] = useState(() => loadSession() || newSession());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const userScrolledUpRef = useRef(false);
  const [showJump, setShowJump] = useState(false);

  const messages = session?.messages || [];

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    // Só auto-scroll se o usuário estiver no final E não tiver explicitamente subido.
    if (!stickToBottomRef.current) return;
    if (userScrolledUpRef.current) return;
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, loading]);

  const canSend = useMemo(() => !loading && input.trim().length > 0, [loading, input]);

  const startNew = () => {
    const fresh = newSession();
    setSession(fresh);
    setInput('');
    setLoading(false);
    stickToBottomRef.current = true;
    userScrolledUpRef.current = false;
    // deixa o DOM atualizar e desce
    setTimeout(scrollToBottom, 0);
  };

  // Trigger externo (AppShell top-actions)
  useEffect(() => {
    if (!resetKey) return;
    startNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

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

    // Ao enviar, assume intenção de ficar no fim do chat.
    stickToBottomRef.current = true;
    userScrolledUpRef.current = false;
    setShowJump(false);
    setTimeout(scrollToBottom, 0);

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
    <div className='flex h-[calc(100dvh-9.75rem)] min-h-0 flex-col gap-4 overflow-hidden'>
      <header className='sticky top-0 z-10 px-1 pt-1'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <img
              src='/favicon.jpg'
              alt='Nicco Finance'
              className='h-10 w-10 shrink-0 rounded-2xl ring-1 ring-white/10'
            />
            <div className='min-w-0'>
              <p className='text-xs font-medium uppercase tracking-[0.2em] text-slate-400'>Assistente</p>
              <h1 className='truncate text-2xl font-bold text-slate-100'>Nicco IA</h1>
            </div>
          </div>
        </div>
      </header>

      {/* ChatGPT-ish: conversa ocupa a página; composer fixo no fundo da viewport (acima do bottom-nav). */}
      <section className='relative min-h-0 flex-1 overflow-hidden'>
        <div
          ref={listRef}
          className='min-h-0 space-y-3 overflow-auto pr-1'
          onScroll={(e) => {
            const el = e.currentTarget;
            const threshold = 48;
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
            stickToBottomRef.current = atBottom;
            userScrolledUpRef.current = !atBottom;
            setShowJump(!atBottom);
          }}
          style={{
            // Espaço pro composer + safe-area + bottom-nav.
            paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom))',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {messages.length === 0 ? (
            <div className='rounded-4xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300'>
              Me pergunta tipo: “quanto gastei por categoria?”, “qual conta mais saiu dinheiro?”, “o que tá pesando esse mês?”.
            </div>
          ) : (
            messages.map((m, idx) => (
              <ChatBubble key={`${m.at || idx}-${idx}`} role={m.role}>
                <RichText text={m.content} />
              </ChatBubble>
            ))
          )}

          {loading && (
            <ChatBubble role='assistant'>
              <span className='text-slate-400'>Pensando…</span>
            </ChatBubble>
          )}
        </div>

        {showJump && (
          <button
            type='button'
            onClick={() => {
              stickToBottomRef.current = true;
              userScrolledUpRef.current = false;
              setShowJump(false);
              scrollToBottom();
            }}
            className='fixed bottom-[calc(9.4rem+env(safe-area-inset-bottom))] right-6 z-40 rounded-full border border-white/10 bg-[rgba(6,6,10,0.88)] px-4 py-2 text-xs font-bold text-slate-100 shadow-soft backdrop-blur active:opacity-90'
          >
            Ir pro fim
          </button>
        )}

        <div
          className='pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px]'
          style={{ paddingBottom: 'calc(6.9rem + env(safe-area-inset-bottom))' }}
        >
          <div className='pointer-events-auto mx-4 rounded-4xl border border-white/10 bg-[rgba(6,6,10,0.88)] p-3 shadow-soft backdrop-blur'>
            <div className='flex items-end gap-2'>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                placeholder='Pergunta pro Nicco IA…'
                className='min-h-[52px] max-h-40 flex-1 resize-none rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 shadow-soft outline-none placeholder:text-slate-500 focus:border-white/20'
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                onFocus={() => {
                  // Se o usuário focou o composer, assume intenção de continuar no fim.
                  stickToBottomRef.current = true;
                  userScrolledUpRef.current = false;
                  setShowJump(false);
                  // re-scroll depois do teclado abrir
                  setTimeout(scrollToBottom, 60);
                  setTimeout(scrollToBottom, 220);
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
            <div className='mt-2 px-1 text-[11px] text-slate-500'>Enter envia · Shift+Enter quebra linha</div>
          </div>
        </div>
      </section>
    </div>
  );
}
