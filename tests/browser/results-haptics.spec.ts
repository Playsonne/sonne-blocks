import { test, expect, type Page } from '@playwright/test';
import { Game, type GameState } from '../../src/game/engine';
import { SAVE_KEY, RECORD_KEY } from '../../src/persistence';
import { PREFERENCES_KEY } from '../../src/preferences';
import type { SessionStats } from '../../src/session';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const stats: SessionStats = { playedMs: 125000, recordAtStart: 2000, completeDuration: true };
function losing(score = 2500) {
  const state = new Game().snapshot();
  state.active = { type: 'I', rotation: 0, x: 3, y: 0 };
  state.board[2][3] = 'T'; state.score = score; state.lines = 12; state.level = 2;
  return state;
}
async function seed(page: Page, state: GameState, session: SessionStats | null = stats, vibration = false, mode = 'buttons', supported = true) {
  await page.addInitScript(({ state, session, vibration, mode, supported, saveKey, recordKey, prefsKey }) => {
    if (!localStorage.getItem('seeded')) {
      localStorage.setItem(saveKey, JSON.stringify({ version: 1, state, ...(session ? { session } : {}) }));
      // The record is already updated during play; the summary must compare with the starting record.
      localStorage.setItem(recordKey, JSON.stringify({ version: 1, score: Math.max(2000, state.score) }));
      localStorage.setItem(prefsKey, JSON.stringify({ version: 1, mode, gesturesExplained: mode === 'gestures', vibration }));
      localStorage.setItem('seeded', 'true');
    }
    (window as any).vibrations = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: supported ? (pattern: number | number[]) => {
      (window as any).vibrations.push(pattern); return true;
    } : undefined });
  }, { state, session, vibration, mode, supported, saveKey: SAVE_KEY, recordKey: RECORD_KEY, prefsKey: PREFERENCES_KEY });
  await page.goto('/');
}
const pulses = (page: Page) => page.evaluate(() => (window as any).vibrations.filter((p: unknown) => p !== 0));
const savedSession = (page: Page): Promise<SessionStats> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).session, SAVE_KEY);

test('resumen móvil: cuatro estadísticas, nuevo récord y reinicio conservando el récord', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, losing()); await page.locator('#play').tap(); await page.locator('[data-action="drop"]').tap();
  await expect(page.getByRole('heading', { name: 'Partida terminada' })).toBeVisible();
  await expect(page.locator('#result-score')).toHaveText('2500');
  await expect(page.locator('#result-lines')).toHaveText('12'); await expect(page.locator('#result-level')).toHaveText('2');
  await expect(page.locator('#result-duration')).toHaveText('02:05');
  await expect(page.locator('#result-duration-note')).toBeHidden();
  await expect(page.locator('#result-record')).toHaveText('¡Nuevo récord personal!');
  await expect(page.getByRole('button', { name: 'Volver a jugar', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBeNull();
  await page.screenshot({ path: 'test-results/resumen-movil.png' });
  await page.locator('#help').tap(); await page.locator('#help-dialog .primary').tap();
  await expect(page.locator('#result-record')).toHaveText('¡Nuevo récord personal!');
  await page.getByRole('button', { name: 'Volver a jugar', exact: true }).tap();
  await expect(page.locator('#score')).toHaveText('0'); await expect(page.locator('#best')).toHaveText('2500');
  expect((await savedSession(page)).playedMs).toBe(0);
  expect((await savedSession(page)).recordAtStart).toBe(2500);
  expect(await pulses(page)).toEqual([]);
});
for (const score of [1500, 2000]) {
  test(`no anuncia récord nuevo con ${score} puntos frente a 2000`, async ({ page }) => {
    await seed(page, losing(score)); await page.locator('#play').tap(); await page.keyboard.press('Space');
    await expect(page.locator('#result-record')).toHaveText('Tu récord: 2000 puntos');
    await expect(page.locator('#result-record')).not.toHaveClass(/new-record/);
  });
}
test('un guardado antiguo conserva la partida y explica que su tiempo es parcial', async ({ page }) => {
  await seed(page, losing(), null); await page.locator('#play').tap(); await page.keyboard.press('Space');
  await expect(page.locator('#result-duration-note')).toBeVisible();
  await expect(page.locator('#result-score')).toHaveText('2500');
});
test('el tiempo sobrevive a recargas offline y no incluye pausas ni segundo plano', async ({ page, context }) => {
  await seed(page, new Game().snapshot());
  await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
  await page.locator('#play').tap(); await page.waitForTimeout(240); await page.locator('#pause').tap();
  const first = await savedSession(page);
  expect(first.playedMs).toBeGreaterThan(125000); expect(first.playedMs).toBeLessThan(126000);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await savedSession(page)).toEqual(first);
  await context.setOffline(true); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
  await page.locator('#play').tap(); await page.waitForTimeout(240); await page.locator('#pause').tap();
  const second = await savedSession(page);
  expect(second.playedMs).toBeGreaterThan(first.playedMs); expect(second.playedMs).toBeLessThan(first.playedMs + 1000);
  expect(second.recordAtStart).toBe(first.recordAtStart); expect(second.completeDuration).toBe(true);
});
test('resumen con texto al 200 % y poca altura permite llegar a Volver a jugar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 400 });
  await seed(page, losing()); await page.locator('#play').tap(); await page.keyboard.press('Space');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.locator('#play').scrollIntoViewIfNeeded();
  await expect(page.locator('#play')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  const overlay = await page.locator('#overlay').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
  expect(overlay.scrollWidth).toBeLessThanOrEqual(overlay.width);
  await page.locator('#play').tap(); await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
});
test('vibración optativa: probar, desactivar, persistir y cancelar al perder foco', async ({ page }) => {
  await seed(page, new Game().snapshot());
  await page.locator('#play').tap(); await page.keyboard.press('Space'); expect(await pulses(page)).toEqual([]);
  await page.locator('#help').tap(); await expect(page.locator('#vibration')).not.toBeChecked();
  await expect(page.locator('#test-vibration')).toBeDisabled();
  await page.locator('#vibration').check(); await page.locator('#test-vibration').tap();
  expect(await pulses(page)).toEqual([[18, 35, 24]]);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => (window as any).vibrations.at(-1))).toBe(0);
  await page.screenshot({ path: 'test-results/ajuste-vibracion.png' });
  await page.reload(); await page.locator('#help').tap(); await expect(page.locator('#vibration')).toBeChecked();
  await page.locator('#vibration').uncheck(); await expect(page.locator('#test-vibration')).toBeDisabled();
  await page.locator('#help-dialog .primary').tap(); await page.locator('#play').tap(); await page.keyboard.press('Space');
  expect(await pulses(page)).toEqual([]);
  await page.reload(); await page.locator('#help').tap(); await expect(page.locator('#vibration')).not.toBeChecked();
});
test('navegador sin vibración muestra la limitación y sigue jugando', async ({ page }) => {
  await seed(page, new Game().snapshot(), stats, true, 'buttons', false);
  await page.locator('#help').tap(); await expect(page.locator('#vibration')).toBeDisabled();
  await expect(page.locator('#test-vibration')).toBeDisabled();
  await expect(page.locator('#vibration-note')).toContainText('no ofrece vibración');
  await page.locator('#help-dialog .primary').tap(); await page.locator('#play').tap(); await page.keyboard.press('Space');
  await expect(page.locator('#score')).not.toHaveText('0'); expect(await pulses(page)).toEqual([]);
});
for (const mode of ['buttons', 'gestures']) {
  test(`${mode}: una caída instantánea produce un único pulso; girar no vibra`, async ({ page }) => {
    const state = new Game().snapshot(); state.active = { type: 'T', rotation: 0, x: 3, y: 3 };
    await seed(page, state, stats, true, mode); await page.locator('#play').tap();
    await page.keyboard.press('ArrowUp'); expect(await pulses(page)).toEqual([]);
    const cdp = mode === 'gestures' ? await page.context().newCDPSession(page) : null;
    if (mode === 'buttons') await page.locator('[data-action="drop"]').tap();
    else {
      const board = (await page.locator('#board').boundingBox())!;
      const x = board.x + board.width / 2, y = board.y + board.height * .25;
      await cdp!.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await cdp!.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + board.width * .6, id: 1 }] });
      expect(await pulses(page)).toEqual([]);
      await cdp!.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    expect(await pulses(page)).toEqual([12]);
    await page.waitForTimeout(100); expect(await pulses(page)).toEqual([12]);
    // Chromium drops the first emulated click after this CDP swipe, including in v1.0.1.
    // Check cancellation via the existing keyboard pause; the buttons case covers touch pause.
    if (cdp) await page.keyboard.press('Escape');
    else await page.locator('#pause').tap();
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
    expect(await page.evaluate(() => (window as any).vibrations.at(-1))).toBe(0);
    await cdp?.detach();
  });
}
for (const natural of [false, true]) {
  test(`completar línea por ${natural ? 'gravedad' : 'caída instantánea'} produce solo el patrón de líneas`, async ({ page }) => {
    const state = new Game().snapshot(); state.active = { type: 'O', rotation: 0, x: 3, y: 20 };
    state.board[21] = Array.from({ length: 10 }, (_, x) => x === 4 || x === 5 ? null : 'J');
    await seed(page, state, stats, true); await page.locator('#play').tap();
    if (!natural) await page.keyboard.press('Space');
    await expect(page.locator('#lines')).toHaveText('1');
    expect(await pulses(page)).toEqual([[18, 35, 24]]);
    await page.waitForTimeout(100); expect(await pulses(page)).toEqual([[18, 35, 24]]);
  });
}
