interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function setupPwa(options: { notify: (message: string) => void; ready: () => void; installHelp: () => void; prepareUpdate: () => void; isPlaying: () => boolean }): void {
  const install = document.querySelector<HTMLButtonElement>('#install')!;
  const banner = document.querySelector<HTMLElement>('#update-banner')!;
  const update = document.querySelector<HTMLButtonElement>('#update')!;
  let prompt: InstallPrompt | undefined;
  const installed = () => matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  install.hidden = installed();
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event as InstallPrompt;
    install.textContent = 'Instalar el juego ↗'; install.hidden = false;
  });
  window.addEventListener('appinstalled', () => { prompt = undefined; install.hidden = true; options.notify('Sonne Blocks ya está instalado.'); });
  install.addEventListener('click', async () => {
    if (!prompt) { options.installHelp(); return; }
    options.prepareUpdate();
    try { await prompt.prompt(); await prompt.userChoice; } catch { options.installHelp(); }
    prompt = undefined;
  });
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  let registration: ServiceWorkerRegistration;
  let reloadRequested = false;
  const available = () => {
    banner.hidden = false;
    update.textContent = options.isPlaying() ? 'Pausar y actualizar' : 'Actualizar';
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A different tab may activate an update. Reload only after this tab's explicit consent.
    if (reloadRequested) window.location.reload();
  });
  update.addEventListener('click', () => {
    if (!registration?.waiting) { banner.hidden = true; return; }
    options.prepareUpdate();
    reloadRequested = true;
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  });
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).then(reg => {
    registration = reg;
    if (reg.waiting) available();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) available();
      });
    });
    navigator.serviceWorker.ready.then(() => {
      document.documentElement.dataset.offlineReady = 'true';
      options.ready();
    });
  }).catch(() => options.notify('El modo sin conexión no está disponible. Puedes seguir jugando.'));
}
