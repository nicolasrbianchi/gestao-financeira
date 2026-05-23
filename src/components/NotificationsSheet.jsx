import React, { useMemo, useRef, useState } from 'react';
import { Bell, ChevronLeft, MailOpen, MailPlus } from 'lucide-react';

function normalizeNotifications(list) {
  return (Array.isArray(list) ? list : [])
    .map((n) => ({
      id: String(n?.id || ''),
      kind: n?.kind || 'Notificação',
      title: n?.title || 'Atualização',
      body: n?.body || '',
      createdAt: n?.createdAt || null,
      readAt: n?.readAt || null,
    }))
    .filter((n) => n.id)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function loadNotifications() {
  try {
    const raw = localStorage.getItem('gf_notifications_v1');
    const arr = raw ? JSON.parse(raw) : [];
    return normalizeNotifications(arr);
  } catch {
    return [];
  }
}

function saveNotifications(list) {
  try {
    localStorage.setItem('gf_notifications_v1', JSON.stringify(list.slice(0, 50)));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event('gf_notifications_changed'));
  } catch {
    // ignore
  }
}

function snippet(text, max = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function SwipeNotificationRow({ n, onOpen, onToggleRead }) {
  const ACTION_W = 104;
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, active: false });

  const onPointerDown = (e) => {
    start.current = { x: e.clientX, y: e.clientY, active: true };
    setDragging(false);
  };

  const onPointerMove = (e) => {
    if (!start.current.active) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (!dragging) {
      if (Math.abs(ddx) < 8) return;
      if (Math.abs(ddy) > Math.abs(ddx)) {
        start.current.active = false;
        return;
      }
      setDragging(true);
    }

    const base = open ? -ACTION_W : 0;
    let next = base + ddx;
    next = Math.min(24, Math.max(next, -ACTION_W - 24));
    setDx(next);
  };

  const endDrag = () => {
    if (!start.current.active) return;
    start.current.active = false;
    if (!dragging) {
      // click
      if (open) {
        setOpen(false);
        setDx(0);
      } else {
        onOpen?.();
      }
      return;
    }
    setDragging(false);
    const shouldOpen = dx < -ACTION_W / 2;
    setOpen(shouldOpen);
    setDx(shouldOpen ? -ACTION_W : 0);
  };

  const isUnread = !n.readAt;
  const actionLabel = isUnread ? 'Marcar como lida' : 'Marcar como não lida';

  return (
    <div className='relative'>
      <div className='pointer-events-none absolute inset-0 flex items-center justify-end pr-2'>
        <button
          type='button'
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleRead?.();
            setOpen(false);
            setDx(0);
          }}
          className='pointer-events-auto flex h-12 items-center gap-2 rounded-3xl bg-slate-950 px-4 text-sm font-extrabold text-white ring-1 ring-white/10'
          aria-label={actionLabel}
        >
          {isUnread ? <MailOpen size={16} /> : <MailPlus size={16} />}
          {isUnread ? 'Lida' : 'Não lida'}
        </button>
      </div>

      <div
        role='button'
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => { if (dragging) endDrag(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen?.(); }}
        className={`relative select-none rounded-4xl border px-4 py-3 ${isUnread ? 'border-white/20 bg-white/95' : 'border-white/10 bg-slate-950/40'}`}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 160ms ease',
        }}
      >
        <div className='flex items-start gap-3'>
          <div className='mt-1'>
            <span className={`block h-2.5 w-2.5 rounded-full ${isUnread ? 'bg-rose-500' : 'bg-white/10'}`} aria-hidden='true' />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center justify-between gap-3'>
              <p className={`truncate text-sm font-extrabold ${isUnread ? 'text-slate-100' : 'text-slate-200'}`}>{n.title}</p>
              {n.createdAt && <p className='shrink-0 text-[11px] font-semibold text-slate-400'>{new Date(n.createdAt).toLocaleDateString()}</p>}
            </div>
            <p
              className='mt-0.5 text-sm text-slate-400'
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {snippet(n.body || n.kind, 140) || n.kind}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsSheet({ open, onClose }) {
  if (!open) return null;

  const [selectedId, setSelectedId] = useState(null);
  const [version, setVersion] = useState(0);
  const notifications = useMemo(() => loadNotifications(), [version]);
  const selected = selectedId ? notifications.find((n) => n.id === selectedId) : null;

  const markRead = (id) => {
    const list = loadNotifications();
    const idx = list.findIndex((n) => n.id === id);
    if (idx < 0) return;
    if (list[idx].readAt) return;
    list[idx] = { ...list[idx], readAt: new Date().toISOString() };
    saveNotifications(list);
    setVersion((v) => v + 1);
  };

  const toggleRead = (id) => {
    const list = loadNotifications();
    const idx = list.findIndex((n) => n.id === id);
    if (idx < 0) return;
    const next = list[idx].readAt ? null : new Date().toISOString();
    list[idx] = { ...list[idx], readAt: next };
    saveNotifications(list);
    setVersion((v) => v + 1);
  };

  return (
    <div className='sheet' role='dialog' aria-modal='true' onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className='sheet-panel space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500'>Notificações</p>
            <h2 className='mt-1 truncate text-xl font-bold text-slate-900'>Central</h2>
            <p className='mt-1 text-sm text-slate-500'>Em breve: alertas e lembretes do Nicco.</p>
          </div>
          <button type='button' onClick={onClose} className='shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500'>Fechar</button>
        </div>

        {selected ? (
          <div className='space-y-3'>
            <button
              type='button'
              onClick={() => setSelectedId(null)}
              className='inline-flex items-center gap-2 rounded-3xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white ring-1 ring-white/10'
            >
              <ChevronLeft size={16} />
              Voltar
            </button>

            <div className='card my-0'>
              <p className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'>{selected.kind}</p>
              <p className='mt-1 text-xl font-extrabold text-slate-100'>{selected.title}</p>
              {selected.createdAt && <p className='mt-2 text-xs text-slate-400'>{new Date(selected.createdAt).toLocaleString()}</p>}
              {selected.body && <p className='mt-3 whitespace-pre-wrap text-sm text-slate-300'>{selected.body}</p>}

              <div className='mt-4 flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => toggleRead(selected.id)}
                  className='inline-flex items-center gap-2 rounded-3xl bg-white/95 px-4 py-3 text-sm font-extrabold text-slate-100'
                >
                  {selected.readAt ? <MailPlus size={16} /> : <MailOpen size={16} />}
                  {selected.readAt ? 'Marcar como não lida' : 'Marcar como lida'}
                </button>
              </div>
            </div>
          </div>
        ) : notifications.length ? (
          <div className='space-y-2'>
            {notifications.map((n) => (
              <SwipeNotificationRow
                key={n.id}
                n={n}
                onOpen={() => {
                  setSelectedId(n.id);
                  markRead(n.id);
                }}
                onToggleRead={() => toggleRead(n.id)}
              />
            ))}
          </div>
        ) : (
          <div className='empty-state shadow-none'>
            <div className='mx-auto mb-2 grid h-12 w-12 place-items-center rounded-3xl bg-slate-50 text-indigo-500'>
              <Bell size={20} />
            </div>
            Nenhuma notificação por enquanto.
          </div>
        )}
      </div>
    </div>
  );
}
