import React from 'react';
import { Bell } from 'lucide-react';

function loadNotifications() {
  try {
    const raw = localStorage.getItem('gf_notifications_v1');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function NotificationsSheet({ open, onClose }) {
  if (!open) return null;

  const notifications = loadNotifications();

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

        {notifications.length ? (
          <div className='space-y-2'>
            {notifications.map((n) => (
              <div key={n.id} className='card my-0'>
                <p className='text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'>{n.kind || 'Notificação'}</p>
                <p className='mt-1 text-base font-extrabold text-slate-900'>{n.title || 'Atualização'}</p>
                {n.body && <p className='mt-1 text-sm text-slate-500'>{n.body}</p>}
                {n.createdAt && <p className='mt-2 text-xs text-slate-400'>{new Date(n.createdAt).toLocaleString()}</p>}
              </div>
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
