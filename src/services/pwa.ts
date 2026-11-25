type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type PwaState = {
  installable: boolean;
  installed: boolean;
  updateReady: boolean;
  offlineReady: boolean;
};

let state: PwaState = { installable: false, installed: false, updateReady: false, offlineReady: false };
let deferredPrompt: InstallPrompt | null = null;
let registration: ServiceWorkerRegistration | null = null;
let started = false;
let reloadRequested = false;

const listeners = new Set<() => void>();
function publish(change: Partial<PwaState>) {
  state = { ...state, ...change };
  listeners.forEach(fn => fn());
}

export const pwaSnapshot = () => state;
export const subscribePwa = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia('(display-mode: standalone)');
  const overlay = window.matchMedia('(display-mode: window-controls-overlay)');
  return media.matches || overlay.matches || (navigator as any).standalone === true;
}

export function initPwa(registerWorker = true) {
  if (started || typeof window === 'undefined') return;
  started = true;

  publish({ installed: isStandaloneApp() });
  const syncInstalled = () => publish({ installed: isStandaloneApp() });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', syncInstalled);
  window.matchMedia('(display-mode: window-controls-overlay)').addEventListener?.('change', syncInstalled);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event as InstallPrompt;
    publish({ installable: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    publish({ installed: true, installable: false });
  });

  if (!registerWorker || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) window.location.reload();
  });

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(reg => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) publish({ updateReady: true });
        const watchInstalling = () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              publish({ updateReady: true });
            }
          });
        };
        reg.addEventListener('updatefound', watchInstalling);
        void navigator.serviceWorker.ready.then(() => publish({ offlineReady: true }));
      })
      .catch(() => {});
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  publish({ installable: false });
  try {
    await event.prompt();
    return (await event.userChoice).outcome;
  } catch {
    return 'unavailable';
  }
}

export function applyPwaUpdate() {
  reloadRequested = true;
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}
