import React, { useMemo, useState } from 'react';
import { Bell, ChevronLeft, MailOpen, MailPlus, Trash2 } from 'lucide-react';

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

function NotificationRow({ n }) {
  const isUnread = !n.readAt;

  return (
    <article
      className={`w-full text-left rounded-4xl border px-4 py-3 ${isUnread ? 'border-white/20 bg-white/95' : 'border-white/10 bg-slate-950/40'}`}
      aria-label={isUnread ? 'Notificação não lida' : 'Notificação lida'}
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
    </article>
  );
}

export default function NotificationsSheet({ open, onClose }) {
  if (!open) return null;

  const [selectedId, setSelectedId] = useState(null);
  const [version, setVersion] = useState(0);
  const notifications = useMemo(() => loadNotifications(), [version]);
  const selected = selectedId ? notifications.find((n) => n.id === selectedId) : null;

  const [openId, setOpenId] = useState(null);
  const dragRef = React.useRef({ id: null, startX: 0, startY: 0, started: false, dragging: false, dx: 0 });
  const ACTION_W = 172; // px (2 ações)

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

  const deleteNotification = (id) => {
    const list = loadNotifications();
    const next = list.filter((n) => n.id !== id);
    saveNotifications(next);
    if (selectedId === id) setSelectedId(null);
    if (openId === id) setOpenId(null);
    setVersion((v) => v + 1);
  };

  const onPointerDown = (event, id) => {
    if (event.pointerType !== 'mouse' && event.isPrimary === false) return;
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      started: true,
      dragging: false,
      dx: 0,
    };
  };

  const onPointerMove = (event, id) => {
    const d = dragRef.current;
    if (!d.started || d.id !== id) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;

    if (!d.dragging) {
      if (Math.abs(dx) < 10) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
      d.dragging = true;
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* ignore */ }
    }

    d.dx = dx;
    if (dx < -18) setOpenId(id);
    if (dx > 18 && openId === id) setOpenId(null);
  };

  const onPointerUp = (_event, id) => {
    const d = dragRef.current;
    if (!d.started || d.id !== id) return;
    const dx = d.dx;
    const shouldOpen = dx < -32;
    const shouldClose = dx > 32;

    if (shouldOpen) setOpenId(id);
    else if (shouldClose) setOpenId(null);
    dragRef.current = { id: null, startX: 0, startY: 0, started: false, dragging: false, dx: 0 };
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
            </div>
          </div>
        ) : notifications.length ? (
          <div className='space-y-2'>
            {notifications.map((n) => {
              const isOpen = openId === n.id;
              const isUnread = !n.readAt;
              const actionLabel = isUnread ? 'Marcar como lida' : 'Marcar como não lida';
              const ActionIcon = isUnread ? MailOpen : MailPlus;

              return (
                <div key={n.id} className='relative overflow-hidden rounded-4xl'>
                  {/* Underlay action */}
                  <div
                    className={`absolute inset-y-0 right-0 flex items-stretch gap-2 pr-2 transition-opacity duration-150 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    style={{ width: ACTION_W }}
                  >
                    <button
                      type='button'
                      className='h-full flex-1 rounded-4xl bg-slate-950/80 px-3 text-[11px] font-extrabold text-white shadow-soft ring-1 ring-black/10'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenId(null);
                        toggleRead(n.id);
                      }}
                      aria-label={actionLabel}
                    >
                      <span className='inline-flex items-center justify-center gap-2'>
                        <ActionIcon size={16} />
                        {actionLabel}
                      </span>
                    </button>

                    <button
                      type='button'
                      className='h-full flex-1 rounded-4xl bg-rose-500/15 px-3 text-[11px] font-extrabold text-rose-700 shadow-soft ring-1 ring-rose-600/20'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const ok = window.confirm('Excluir esta notificação?');
                        if (!ok) return;
                        deleteNotification(n.id);
                      }}
                      aria-label='Excluir notificação'
                    >
                      <span className='inline-flex items-center justify-center gap-2'>
                        <Trash2 size={16} />
                        Excluir
                      </span>
                    </button>
                  </div>

                  {/* Foreground card (swipe) */}
                  <div
                    className='transition-transform duration-150'
                    style={{ transform: isOpen ? `translateX(-${ACTION_W}px)` : 'translateX(0px)' }}
                    onPointerDown={(e) => onPointerDown(e, n.id)}
                    onPointerMove={(e) => onPointerMove(e, n.id)}
                    onPointerUp={(e) => onPointerUp(e, n.id)}
                    onPointerCancel={(e) => onPointerUp(e, n.id)}
                    onClick={() => {
                      if (isOpen) return setOpenId(null);
                      setSelectedId(n.id);
                      markRead(n.id);
                    }}
                    role='button'
                    tabIndex={0}
                  >
                    <NotificationRow n={n} />
                  </div>
                </div>
              );
            })}
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
