import { test, expect, type Page } from '@playwright/test';
import { Game } from '../../src/game/engine';
import { SAVE_KEY } from '../../src/persistence';
import { PREFERENCES_KEY } from '../../src/preferences';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function load(page: Page, options: { count?: number; enabled?: boolean; mode?: string; clock?: boolean } = {}) {
  const { count = 4, enabled = true, mode = 'buttons', clock = true } = options;
  const state = new Game(() => .4).snapshot();
  state.active = { type: 'I', rotation: 1, x: 3, y: 18 }; state.next = 'T';
  state.lines = 6;
  for (let y = 22 - count; y < 22; y++) state.board[y] = Array.from({ length: 10 }, (_, x) => x === 5 ? null : (x % 2 ? 'J' : 'S'));
  state.board[10][0] = 'T';
  if (clock) await page.clock.install({ time: new Date('2026-10-11T10:00:00Z') });
  await page.addInitScript(({ state, enabled, mode, key, prefs }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, state }));
    if (!localStorage.getItem(prefs)) localStorage.setItem(prefs, JSON.stringify({ version: 1, mode, gesturesExplained: mode === 'gestures', vibration: true, lineAnimation: enabled }));
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
  }, { state, enabled, mode, key: SAVE_KEY, prefs: PREFERENCES_KEY });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
  if (clock) await page.clock.pauseAt(new Date('2026-10-11T10:05:00Z'));
}
async function clear(page: Page) {
  // The stopped clock makes screenshots and pixel comparisons reproducible.
  await page.locator('#play').dispatchEvent('click');
  await page.clock.runFor(32);
  await page.keyboard.press('Space');
  await page.clock.runFor(64);
}
async function bottomPixel(page: Page) {
  return page.locator('#board').evaluate((canvas: HTMLCanvasElement) => {
    // A cleared cell away from both the new piece and its ghost, and away from grid lines.
    return Array.from(canvas.getContext('2d')!.getImageData(Math.floor(canvas.width * .15), Math.floor(canvas.height * .975), 1, 1).data);
  });
}
const bottomAlpha = async (page: Page) => (await bottomPixel(page))[3];
const state = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY);

for (const count of [1, 4]) {
  test(`${count} filas: se dibujan sus colores y desaparecen sin retrasar puntos ni controles`, async ({ page }) => {
    await load(page, { count }); await clear(page);
    await expect(page.locator('#lines')).toHaveText(String(6 + count));
    await expect(page.locator('#score')).toHaveText(count === 4 ? '800' : '100');
    // The initial flash must be bright and opaque, including a single-row clear.
    const pixel = await bottomPixel(page);
    expect(pixel[1]).toBeGreaterThan(230); expect(pixel[3]).toBeGreaterThan(240);
    const locked = await state(page);
    expect(locked.active.type).toBe('T'); expect(locked.active.x).toBe(3);
    expect(locked).not.toHaveProperty('lastClearedRows');
    await page.screenshot({ path: `test-results/animacion-${count}-filas-destello.png` });
    await page.keyboard.press('ArrowLeft');
    await page.clock.runFor(256); expect(await bottomAlpha(page)).toBeGreaterThan(120);
    // It remains clearly visible beyond the entire duration of the previous effect.
    await page.screenshot({ path: `test-results/animacion-${count}-filas-fragmentos.png` });
    await page.clock.runFor(240); expect(await bottomAlpha(page)).toBe(0);
    await page.keyboard.press('Escape');
    expect((await state(page)).active.x).toBe(2);
    expect((await state(page)).lines).toBe(6 + count);
  });
}
test('desactivada: mismas líneas, puntos y siguiente pieza, sin efecto y con aviso estático', async ({ page }) => {
  await load(page, { enabled: false }); await clear(page);
  expect(await bottomAlpha(page)).toBe(0);
  await expect(page.locator('#score')).toHaveText('800');
  expect((await state(page)).active.type).toBe('T');
  await expect(page.locator('#clear-message')).toHaveText('¡4 líneas!');
  expect(await page.locator('#clear-message').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
test('la preferencia se conserva offline sin cambiar Gestos ni vibración', async ({ page, context }) => {
  await load(page, { mode: 'gestures', clock: false });
  await page.locator('#help').tap();
  await expect(page.locator('#line-animation')).toBeChecked();
  await page.locator('#line-animation').uncheck();
  await expect(page.locator('input[value="gestures"]')).toBeChecked();
  await expect(page.locator('#vibration')).toBeChecked();
  await page.locator('#help-dialog .primary').tap();
  await context.setOffline(true); await page.reload();
  await page.locator('#help').tap(); await expect(page.locator('#line-animation')).not.toBeChecked();
  await expect(page.locator('input[value="gestures"]')).toBeChecked(); await expect(page.locator('#vibration')).toBeChecked();
  await page.locator('#line-animation').check();
  await page.reload(); await page.locator('#help').tap(); await expect(page.locator('#line-animation')).toBeChecked();
});
test('reducción de movimiento al cargar: sin animación y explicación accesible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page); await clear(page);
  expect(await bottomAlpha(page)).toBe(0);
  await page.locator('#help').dispatchEvent('click');
  await expect(page.locator('#line-animation')).not.toBeChecked(); await expect(page.locator('#line-animation')).toBeDisabled();
  await expect(page.locator('#line-animation-note')).toContainText('reducción de movimiento');
});
test('activar reducción de movimiento durante el efecto lo cancela sin cambiar la partida', async ({ page }) => {
  await load(page); await clear(page); expect(await bottomAlpha(page)).toBeGreaterThan(0);
  const before = await state(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-line-animation', 'false');
  await page.clock.runFor(16); expect(await bottomAlpha(page)).toBe(0);
  expect(await state(page)).toEqual(before);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-line-animation', 'true');
  await page.clock.runFor(16); expect(await bottomAlpha(page)).toBe(0);
});
for (const interruption of ['pause', 'resize', 'new-lock']) {
  test(`${interruption}: no quedan efectos sobre el tablero posterior`, async ({ page }) => {
    await load(page); await clear(page); expect(await bottomAlpha(page)).toBeGreaterThan(0);
    if (interruption === 'pause') await page.keyboard.press('Escape');
    if (interruption === 'resize') await page.setViewportSize({ width: 412, height: 915 });
    if (interruption === 'new-lock') await page.keyboard.press('Space');
    await page.clock.runFor(32);
    expect(await bottomAlpha(page)).toBe(0);
    await expect(page.locator('#lines')).toHaveText('10');
    if (interruption === 'pause') {
      await expect(page.locator('#clear-message')).not.toHaveClass(/flash/);
      await page.locator('#play').dispatchEvent('click'); await page.clock.runFor(32);
      expect(await bottomAlpha(page)).toBe(0);
    }
  });
}
