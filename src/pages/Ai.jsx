import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Send } from 'lucide-react';

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
  const atBottomRef = useRef(true);
  const pendingAutoScrollRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const showJumpRef = useRef(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const unseenRef = useRef(0);

  const messages = session?.messages || [];

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const isAtBottom = (el) => (el.scrollHeight - el.scrollTop - el.clientHeight) < 12;

  const scrollToBottom = (behavior = 'auto') => {
    const el = listRef.current;
    if (!el) return;
    const top = Math.max(0, el.scrollHeight - el.clientHeight);
    // scrollTo é mais estável que mexer em scrollTop em alguns browsers
    el.scrollTo({ top, behavior });
  };

  useLayoutEffect(() => {
    // Auto-scroll *apenas* quando:
    // - o usuário estava no fundo; ou
    // - ele acabou de enviar mensagem (pendingAutoScrollRef)
    if (!atBottomRef.current && !pendingAutoScrollRef.current) return;
    scrollToBottom('auto');
    pendingAutoScrollRef.current = false;
    if (showJumpRef.current) {
      showJumpRef.current = false;
      setShowJump(false);
    }
    if (unseenRef.current) {
      unseenRef.current = 0;
      setUnseenCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, loading]);

  // Se chegaram mensagens novas enquanto o usuário está “lá em cima”, mostra badge.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = isAtBottom(el);
    if (atBottom) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role !== 'assistant') return;

    unseenRef.current += 1;
    setUnseenCount(unseenRef.current);
    showJumpRef.current = true;
    setShowJump(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const canSend = useMemo(() => !loading && input.trim().length > 0, [loading, input]);

  const startNew = () => {
    const fresh = newSession();
    setSession(fresh);
    setInput('');
    setLoading(false);
    atBottomRef.current = true;
    pendingAutoScrollRef.current = true;
    showJumpRef.current = false;
    setShowJump(false);
    unseenRef.current = 0;
    setUnseenCount(0);
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

    // Ao enviar, sempre mantém no fim.
    pendingAutoScrollRef.current = true;
    atBottomRef.current = true;
    showJumpRef.current = false;
    setShowJump(false);
    unseenRef.current = 0;
    setUnseenCount(0);
    setTimeout(() => scrollToBottom('auto'), 0);

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
    <div className='flex h-full min-h-0 flex-col gap-4 overflow-hidden'>
      <header className='sticky top-0 z-10 px-1 pt-1'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <img
              src='/icons/icon-192.png'
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

      {/* Chat: header fixo, rolagem só nas mensagens, composer sticky (evita bugs iOS com fixed). */}
      <section className='relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-4xl border border-white/10 bg-[rgba(10,10,16,0.70)]'>
        <div
          ref={listRef}
          className='min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pr-1'
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = isAtBottom(el);
            atBottomRef.current = atBottom;

            if (atBottom && unseenRef.current) {
              unseenRef.current = 0;
              setUnseenCount(0);
            }

            const nextShow = !atBottom && (messages.length > 0 || loading);
            if (nextShow !== showJumpRef.current) {
              showJumpRef.current = nextShow;
              setShowJump(nextShow);
            }
          }}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            padding: '0.25rem',
            // espaço pro composer + bottom nav (iOS tende a "comer" um pouco)
            scrollPaddingBottom: '9.5rem',
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
              pendingAutoScrollRef.current = true;
              atBottomRef.current = true;
              showJumpRef.current = false;
              setShowJump(false);
              unseenRef.current = 0;
              setUnseenCount(0);
              scrollToBottom('smooth');
            }}
            className='absolute right-4 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[rgba(10,10,16,0.9)] text-slate-100 shadow-soft backdrop-blur'
            style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
            aria-label='Ir para o fim'
          >
            <ChevronDown size={18} />
          </button>
        )}

        {showJump && unseenCount > 0 && (
          <div
            className='absolute left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-[rgba(10,10,16,0.9)] px-3 py-1.5 text-xs font-bold text-slate-100 shadow-soft backdrop-blur'
            style={{ bottom: 'calc(5.35rem + env(safe-area-inset-bottom))' }}
            aria-live='polite'
          >
            {unseenCount} nova(s)
          </div>
        )}

        {/* Botão "Ir pro fim" aparece só quando o usuário não está no final. */}

        <div
          className='sticky bottom-0 border-t border-white/10 bg-[rgba(6,6,10,0.88)] px-3 py-3 backdrop-blur'
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
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
        </div>
      </section>
    </div>
  );
}
