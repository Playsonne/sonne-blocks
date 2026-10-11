import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { Game } from '../../src/game/engine';
import { SAVE_KEY } from '../../src/persistence';
const base = () => {
  const game = new Game(() => .4);
  game.state.active = { type: 'T', x: 3, y: 3, rotation: 0 };
  return game.snapshot();
};
async function loadSaved(page: Page) {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify({ version: 1, state })), { key: SAVE_KEY, state: base() });
  await page.goto('/'); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}
async function checkpoint(page: Page) {
  await page.keyboard.press('Escape');
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY);
}
test('escritorio: inicio, teclado, reserva, pausa y recuperación sin reanudar', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await expect(page).toHaveTitle(/Sonne Blocks/);
  const buildId = readFileSync('dist/sw.js', 'utf8').match(/const VERSION = '([^']+)'/)![1];
  const release = JSON.parse(readFileSync('package.json', 'utf8')).version;
  await expect(page.locator('#app-version')).toHaveText(`v${release} · ${buildId.slice(0, 7)}`);
  await expect(page.locator('#app-version')).toBeVisible();
  await page.screenshot({ path: 'test-results/escritorio-inicio.png', fullPage: true });
  await page.getByRole('button', { name: 'Empezar', exact: false }).click();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('KeyC');
  await expect(page.locator('#hold-note')).toHaveText('Ya utilizada');
  await page.keyboard.press('Space'); await expect(page.locator('#hold-note')).toHaveText('Disponible');
  await expect(page.locator('#score')).not.toHaveText('0');
  const state = await checkpoint(page);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state.score, SAVE_KEY)).toBe(state.score);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.screenshot({ path: 'test-results/escritorio-jugando.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('pulsación mantenida, varias pulsaciones y cancelación no dejan movimiento atascado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await loadSaved(page);
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const left = (await page.locator('[data-action="left"]').boundingBox())!;
  const down = (await page.locator('[data-action="down"]').boundingBox())!;
  const a = { x: left.x + left.width / 2, y: left.y + left.height / 2, id: 1 };
  const b = { x: down.x + down.width / 2, y: down.y + down.height / 2, id: 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
  await page.waitForTimeout(280);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [a] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const state = await checkpoint(page);
  expect(state.active.x).toBeLessThan(3); expect(state.active.y).toBeGreaterThan(3);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click(); await page.waitForTimeout(240);
  const next = await checkpoint(page); expect(next.active.x).toBe(state.active.x); expect(next.active.y).toBe(state.active.y);
});
test('repetición de teclado y direcciones opuestas', async ({ page }) => {
  await loadSaved(page); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(210);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(210); await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowLeft');
  const state = await checkpoint(page); expect(state.active.x).toBeGreaterThanOrEqual(0); expect(state.active.x).toBeLessThanOrEqual(7);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click(); await page.waitForTimeout(200);
  expect((await checkpoint(page)).active.x).toBe(state.active.x);
});
test('segundo plano y ayuda siempre requieren continuar explícitamente', async ({ page }) => {
  await loadSaved(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
  const before = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  await page.waitForTimeout(1100); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(before);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Cómo jugar' }).click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Entendido', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
});
test('guardado corrupto y almacenamiento bloqueado no impiden jugar', async ({ page, browser }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{corrupto'), SAVE_KEY); await page.goto('/');
  await page.getByRole('button', { name: 'Empezar', exact: false }).click(); await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
  const context = await browser.newContext(); const privatePage = await context.newPage();
  await privatePage.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Bloqueado'); } }); });
  await privatePage.goto('http://localhost:4283'); await privatePage.getByRole('button', { name: 'Empezar', exact: false }).click();
  await expect(privatePage.locator('html')).toHaveAttribute('data-game-status', 'playing');
  await expect(privatePage.locator('#game-caption')).toContainText('no disponible'); await context.close();
});
test('instalación: ayuda en español y manifest con iconos locales', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href)).json());
  expect(manifest.display).toBe('standalone'); expect(manifest.lang).toBe('es');
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true);
  // Do not invoke a browser-owned native prompt in an automated test.
  await page.evaluate(() => { document.querySelector<HTMLDialogElement>('#install-dialog')!.showModal(); });
  await expect(page.getByRole('heading', { name: 'En iPhone o iPad' })).toBeVisible();
});
test('carga completa, recarga y juego sin conexión', async ({ page, context }) => {
  await page.goto('/'); await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
  await page.getByRole('button', { name: 'Empezar', exact: false }).click(); await page.keyboard.press('Space'); await checkpoint(page);
  const displayedVersion = await page.locator('#app-version').textContent();
  await context.setOffline(true); await page.reload();
  await expect(page.locator('#app-version')).toHaveText(displayedVersion!);
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click(); await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.screenshot({ path: 'test-results/offline.png' });
  await context.setOffline(false);
});
test('una actualización espera sin interrumpir; al aceptarla se guarda y vuelve en pausa', async ({ page }) => {
  const path = 'dist/sw.js'; const original = readFileSync(path, 'utf8');
  const htmlPath = 'dist/index.html', originalHtml = readFileSync(htmlPath, 'utf8');
  await page.goto('/'); await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
  await page.getByRole('button', { name: 'Empezar', exact: false }).click(); await page.keyboard.press('Space');
  const score = await page.locator('#score').textContent();
  const oldLabel = (await page.locator('#app-version').textContent())!;
  const updatedId = '0123456789abcdef', updatedLabel = oldLabel.replace(/[a-f\d]{7}$/, updatedId.slice(0, 7));
  try {
    writeFileSync(htmlPath, originalHtml.replace(oldLabel, updatedLabel));
    writeFileSync(path, original.replace(/const VERSION = '[^']+';/, `const VERSION = '${updatedId}';`));
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg!.update(); });
    await expect(page.locator('#update-banner')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
    await expect(page.locator('#app-version')).toHaveText(oldLabel);
    await page.locator('#update').click();
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
    await expect(page.locator('#score')).toHaveText(score!);
    await expect(page.locator('#app-version')).toHaveText(updatedLabel);
  } finally { writeFileSync(htmlPath, originalHtml); writeFileSync(path, original); }
});
test('subcarpeta: recursos, scope, instalación y recarga sin conexión', async ({ page, context }) => {
  await page.goto('http://localhost:4284/TETRIS/');
  await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
  const details = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const manifestUrl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
    const manifest = await (await fetch(manifestUrl)).json();
    return { scope: registration?.scope, start: new URL(manifest.start_url, manifestUrl).href, assets: (await (await caches.open((await caches.keys())[0])).keys()).map(request => request.url) };
  });
  expect(details.scope).toBe('http://localhost:4284/TETRIS/'); expect(details.start).toBe(details.scope);
  expect(details.assets.every(url => url.startsWith(details.scope!))).toBe(true);
  await page.getByRole('button', { name: 'Empezar', exact: false }).click(); await page.keyboard.press('Space'); await checkpoint(page);
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click(); await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
  await context.setOffline(false);
});
