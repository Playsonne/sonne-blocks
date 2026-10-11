import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { Game, type GameState } from '../../src/game/engine';
import { SAVE_KEY } from '../../src/persistence';
import { PREFERENCES_KEY } from '../../src/preferences';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
type Point = { x: number; y: number; id: number };
async function load(page: Page, mode: 'buttons' | 'gestures') {
  const state = new Game(() => .4).snapshot();
  state.active = { type: 'T', x: 3, y: 3, rotation: 0 };
  await page.addInitScript(({ state, mode, save, prefs }) => {
    localStorage.setItem(save, JSON.stringify({ version: 1, state }));
    localStorage.setItem(prefs, JSON.stringify({ version: 1, mode, gesturesExplained: true }));
  }, { state, mode, save: SAVE_KEY, prefs: PREFERENCES_KEY });
  await page.goto('/'); await page.locator('#play').tap();
  return page.context().newCDPSession(page);
}
const send = (session: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Point[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints });
async function center(page: Page, selector: string) {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function viewport(page: Page) {
  return page.evaluate(() => ({ scale: visualViewport!.scale, x: scrollX, y: scrollY, vx: visualViewport!.offsetLeft, vy: visualViewport!.offsetTop }));
}
async function pinch(page: Page, session: CDPSession, point: { x: number; y: number }) {
  const fingers = (radius: number) => [{ x: point.x - radius, y: point.y, id: 1 }, { x: point.x + radius, y: point.y, id: 2 }];
  await send(session, 'touchStart', fingers(12).slice(0, 1));
  await send(session, 'touchStart', fingers(12));
  for (let step = 1; step <= 8; step++) {
    await send(session, 'touchMove', fingers(12 + step * 6));
    await page.waitForTimeout(16);
  }
  await send(session, 'touchEnd', []);
  await page.waitForTimeout(100); // Finish the emulated input; this does not simulate Android/iOS browser chrome.
}
async function swipe(page: Page, session: CDPSession, point: { x: number; y: number }, dy: number) {
  await send(session, 'touchStart', [{ ...point, id: 1 }]);
  for (let step = 1; step <= 6; step++) {
    await send(session, 'touchMove', [{ x: point.x, y: point.y + dy * step / 6, id: 1 }]);
    await page.waitForTimeout(20);
  }
  await send(session, 'touchEnd', []); await page.waitForTimeout(100);
}
async function checkpoint(page: Page): Promise<GameState> {
  await page.keyboard.press('Escape');
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY);
}

for (const mode of ['buttons', 'gestures'] as const) {
  test(`${mode}: pellizco sin zoom sobre tablero, Reserva y espacios de juego`, async ({ page }) => {
    const session = await load(page, mode), before = await viewport(page);
    // Cover both the outer gaps/Reserve and the board's overflow:hidden scroll boundary.
    for (const selector of ['.game', '.board-wrap']) expect(await page.locator(selector).evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
    const game = (await page.locator('.game').boundingBox())!, stage = (await page.locator('.stage').boundingBox())!;
    const points = [await center(page, '#board'), await center(page, '#hold-box'),
      { x: game.x + game.width / 2, y: stage.y - 2 }];
    for (const point of points) {
      await pinch(page, session, point);
      expect(await viewport(page)).toEqual(before);
    }
    const state = await checkpoint(page);
    expect(state.active.x).toBe(3); expect(state.active.rotation).toBe(0);
    expect(state.board.flat().filter(Boolean)).toHaveLength(0);
  });

  test(`${mode}: arrastrar desde el tablero no desplaza la página ni inicia scroll desde arriba`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 350 });
    const session = await load(page, mode);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(350);
    const before = await viewport(page), point = { x: 180, y: 245 };
    await swipe(page, session, point, -80); expect(await viewport(page)).toEqual(before);
    await swipe(page, session, point, 80); expect(await viewport(page)).toEqual(before);
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
  });

  test(`${mode}: dos toques rápidos producen dos giros, sin zoom ni clic duplicado`, async ({ page }) => {
    const session = await load(page, mode), before = await viewport(page);
    const board = (await page.locator('#board').boundingBox())!;
    const point = mode === 'gestures' ? { x: board.x + board.width * .75, y: board.y + board.height * .35 }
      : await center(page, '[data-action="cw"]');
    for (let i = 0; i < 2; i++) {
      await send(session, 'touchStart', [{ ...point, id: 1 }]);
      await send(session, 'touchEnd', []); await page.waitForTimeout(45);
    }
    expect(await viewport(page)).toEqual(before);
    const state = await checkpoint(page); expect(state.active.rotation).toBe(2); expect(state.active.x).toBe(3);
    expect(state.board.flat().filter(Boolean)).toHaveLength(0);
  });
}

test('Botones conserva izquierda + caída suave simultáneas, sin zoom ni movimiento residual', async ({ page }) => {
  const session = await load(page, 'buttons'), before = await viewport(page);
  const a = { ...await center(page, '[data-action="left"]'), id: 1 }, b = { ...await center(page, '[data-action="down"]'), id: 2 };
  await send(session, 'touchStart', [a]); await send(session, 'touchStart', [a, b]);
  await page.waitForTimeout(220);
  await send(session, 'touchMove', [{ ...a, x: a.x - 15 }, { ...b, x: b.x + 25 }]);
  await send(session, 'touchEnd', [a]); await send(session, 'touchEnd', []);
  expect(await viewport(page)).toEqual(before);
  const state = await checkpoint(page); expect(state.active.x).toBeLessThan(3); expect(state.active.y).toBeGreaterThan(3); expect(state.active.rotation).toBe(0);
  await page.locator('#play').tap(); await page.waitForTimeout(100);
  expect((await checkpoint(page)).active.x).toBe(state.active.x);
});

test('la ayuda conserva scroll táctil y texto ampliado; el viewport permite zoom', async ({ page }, testInfo) => {
  const session = await load(page, 'gestures'); await page.locator('#help').tap();
  const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(meta).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale|minimum-scale/);
  const help = page.locator('#help-dialog');
  for (const selector of ['html', 'body', '.game', '.board-wrap', '#help-dialog']) {
    expect(await page.locator(selector).evaluate(el => getComputedStyle(el).touchAction)).toBe('auto');
  }
  const point = await center(page, '#help-dialog');
  await swipe(page, session, point, -120);
  expect(await help.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await pinch(page, session, point);
  await testInfo.attach('escala-ayuda-emulada', { body: JSON.stringify(await viewport(page)), contentType: 'application/json' });
  // Edge on this Windows host does not zoom even on this unrestricted positive control.
  // Do not claim native pinch/double-tap zoom validation from a stationary emulated scale.
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await help.locator('p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(28);
  expect(await help.evaluate(el => el.scrollHeight > el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('radio', { name: 'Botones', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Botones', exact: true })).toBeChecked();
  await help.locator('.primary').scrollIntoViewIfNeeded(); await expect(help.locator('.primary')).toBeInViewport();
});
