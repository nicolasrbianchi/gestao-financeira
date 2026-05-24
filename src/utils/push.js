function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch {
    return null;
  }
}

export async function subscribeToPush(api) {
  if (!isPushSupported()) throw new Error('Push não suportado neste dispositivo/navegador.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada.');

  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Falha ao registrar Service Worker.');

  // Reusa subscription existente
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await api('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: existing }) });
    return { ok: true, reused: true };
  }

  const keyResp = await api('/push/public-key');
  const publicKey = String(keyResp?.publicKey || '').trim();
  if (!publicKey) throw new Error('Chave pública de push não configurada no servidor.');

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await api('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) });
  return { ok: true, reused: false };
}

export async function unsubscribeFromPush(api) {
  if (!isPushSupported()) return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: true };

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch { /* ignore */ }
  try { await api('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }); } catch { /* ignore */ }
  return { ok: true };
}

