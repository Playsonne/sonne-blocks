import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { Game, type GameState } from '../../src/game/engine';
import { SAVE_KEY } from '../../src/persistence';
import { PREFERENCES_KEY } from '../../src/preferences';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
function sample() {
  const state = new Game(() => .4).snapshot();
  state.active = { type: 'T', x: 3, y: 3, rotation: 0 }; return state;
}
async function load(page: Page, state = sample(), gestures = true) {
  await page.addInitScript(({ state, saveKey, prefsKey, gestures }) => {
    if (!localStorage.getItem(saveKey)) localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }));
    if (gestures && !localStorage.getItem(prefsKey)) localStorage.setItem(prefsKey, JSON.stringify({ version: 1, mode: 'gestures', gesturesExplained: true }));
  }, { state, saveKey: SAVE_KEY, prefsKey: PREFERENCES_KEY, gestures });
  await page.goto('/');
  await page.locator('#play').tap();
}
async function stored(page: Page): Promise<GameState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY);
}
async function checkpoint(page: Page) { await page.keyboard.press('Escape'); return stored(page); }
const occupied = (state: GameState) => state.board.flat().filter(Boolean).length;
async function finger(page: Page) {
  const session = await page.context().newCDPSession(page), b = (await page.locator('#board').boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height * .32, cell = b.width / 10;
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: { x: number; y: number; id: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return { session, b, x, y, cell, send,
    start: (dx = 0, dy = 0) => send('touchStart', [{ x: x + dx, y: y + dy, id: 1 }]),
    move: (dx: number, dy = 0) => send('touchMove', [{ x: x + dx, y: y + dy, id: 1 }]),
    end: () => send('touchEnd', []), cancel: () => send('touchCancel', []),
  };
}

test('Botones por defecto; explicación cancelable, selección persistente y regreso sin perder la partida', async ({ page }) => {
  await load(page, sample(), false);
  await expect(page.locator('html')).toHaveAttribute('data-control-mode', 'buttons');
  const before = (await page.locator('#board').boundingBox())!.height;
  await page.locator('#help').tap(); await page.getByRole('radio', { name: 'Gestos', exact: true }).check();
  await expect(page.locator('#gesture-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Volver a los ajustes' }).tap();
  await expect(page.getByRole('radio', { name: 'Botones', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Gestos', exact: true }).check();
  await page.locator('#start-gestures').tap();
  await expect(page.locator('html')).toHaveAttribute('data-control-mode', 'gestures');
  await expect(page.locator('.controls')).toBeHidden();
  await expect.poll(async () => (await page.locator('#board').boundingBox())!.height).toBeGreaterThan(before + 80);
  await page.keyboard.press('ArrowLeft'); const saved = await checkpoint(page);
  expect(saved.active.x).toBe(2);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-control-mode', 'gestures');
  expect((await stored(page)).active).toEqual(saved.active);
  await page.locator('#help').tap(); await page.getByRole('radio', { name: 'Botones', exact: true }).check();
  await page.getByRole('radio', { name: 'Gestos', exact: true }).check();
  await expect(page.locator('#gesture-dialog')).toBeHidden();
  await page.getByRole('radio', { name: 'Botones', exact: true }).check();
  await page.locator('#help-dialog .primary').tap(); await page.locator('#play').tap();
  await page.locator('[data-action="right"]').tap();
  expect((await checkpoint(page)).active.x).toBe(3);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-control-mode', 'buttons');
});

test('toques en ambas mitades giran una vez; Reserva admite tacto, Enter y Espacio', async ({ page }) => {
  await load(page);
  const f = await finger(page);
  await f.start(f.cell * 3); await f.end();
  expect((await checkpoint(page)).active.rotation).toBe(1);
  await page.locator('#play').tap(); await f.start(-f.cell * 3); await f.end();
  expect((await checkpoint(page)).active.rotation).toBe(0);
  await page.locator('#play').tap(); await page.locator('#hold-box').tap();
  await expect(page.locator('#hold-box')).toBeDisabled(); await expect(page.locator('#hold-note')).toHaveText('Ya utilizada');
  await page.keyboard.press('Space'); await expect(page.locator('#hold-box')).toBeEnabled();
  await page.locator('#hold-box').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#hold-box')).toBeDisabled();
  await page.locator('#hold-box').evaluate(el => el.blur()); await page.keyboard.press('Space');
  const before = await page.locator('#score').textContent();
  await page.locator('#hold-box').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#hold-box')).toBeDisabled(); await expect(page.locator('#score')).toHaveText(before!);
});

test('arrastre continuo revierte, bloquea eje y no acaba en giro o caída', async ({ page }) => {
  await load(page); const f = await finger(page);
  await f.start(); await f.move(f.cell * 1.6); await f.move(-f.cell * 1.8);
  await f.move(-f.cell * 1.8, f.cell * 5); await f.end();
  const state = await checkpoint(page);
  expect(state.active.x).toBe(2); expect(state.active.rotation).toBe(0); expect(occupied(state)).toBe(0);
});

test('arrastre lento baja sin fijar; cada deslizamiento rápido fija solo una pieza al soltar', async ({ page }) => {
  await load(page); const f = await finger(page);
  await f.start(); await f.move(0, f.cell * 1.5); await page.waitForTimeout(340); await f.move(0, f.cell * 3.5); await f.end();
  const soft = await checkpoint(page); expect(soft.active.y).toBeGreaterThan(3); expect(soft.score).toBeGreaterThan(0); expect(occupied(soft)).toBe(0); expect(soft.active.rotation).toBe(0);
  await page.locator('#play').tap();
  await f.start(); await f.move(0, f.cell * 6);
  // No lock has been saved during the contact; the next piece must wait for release.
  expect(occupied(await stored(page))).toBe(0);
  await f.end();
  const first = await checkpoint(page); expect(occupied(first)).toBe(4);
  expect(first.active.rotation).toBe(0); expect(first.active.x).toBe(3);
  await page.locator('#play').tap(); await f.start(); await f.move(0, f.cell * 6); await f.end();
  expect(occupied(await checkpoint(page))).toBe(8);
});

test('fijación natural durante el contacto: la siguiente pieza queda intacta hasta un nuevo contacto', async ({ page }) => {
  const state = sample(); state.active.y = 20;
  await load(page, state); const f = await finger(page);
  await f.start(); await page.waitForTimeout(650);
  await f.move(f.cell * 2, f.cell * 4); await f.end();
  const next = await checkpoint(page); expect(occupied(next)).toBe(4); expect(next.active.x).toBe(3); expect(next.active.rotation).toBe(0);
  await page.locator('#play').tap(); await f.start(); await f.move(f.cell * .7); await f.end();
  expect((await checkpoint(page)).active.x).toBe(4);
});

for (const replacement of ['KeyC', 'Space']) {
  test(`el teclado reemplaza la pieza (${replacement}) y cancela el gesto pendiente`, async ({ page }) => {
    await load(page); const f = await finger(page); await f.start(); await page.keyboard.press(replacement);
    await f.move(f.cell * 3, f.cell * 5); await f.end();
    const state = await checkpoint(page); expect(state.active.x).toBe(3); expect(state.active.rotation).toBe(0);
    expect(occupied(state)).toBe(replacement === 'Space' ? 4 : 0);
  });
}

for (const reason of ['pause', 'blur', 'visibility', 'pagehide', 'resize', 'pointercancel', 'capture']) {
  test(`cancelación por ${reason}: no queda movimiento ni giro al soltar`, async ({ page }) => {
    await load(page); const f = await finger(page);
    if (reason === 'capture') await page.locator('#board').evaluate(el => el.addEventListener('pointerdown', e => el.setAttribute('data-test-pointer', String((e as PointerEvent).pointerId)), { once: true }));
    await f.start(); await f.move(f.cell * .7);
    if (reason === 'pause') await page.keyboard.press('Escape');
    if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    if (reason === 'pagehide') await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    if (reason === 'visibility') await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); delete (document as unknown as { hidden?: boolean }).hidden;
    });
    if (reason === 'resize') await page.setViewportSize({ width: 412, height: 915 });
    if (reason === 'pointercancel') await f.cancel();
    if (reason === 'capture') await page.locator('#board').evaluate(el => el.releasePointerCapture(Number(el.getAttribute('data-test-pointer'))));
    if (['pause', 'blur', 'visibility', 'pagehide'].includes(reason)) {
      await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
      // Keyboard activation resumes while the old finger is still down.
      await page.locator('#play').focus(); await page.keyboard.press('Enter');
    }
    if (reason !== 'pointercancel') { await f.move(f.cell * 3, f.cell * 5); await f.end(); }
    const state = await checkpoint(page); expect(state.active.x).toBe(4); expect(state.active.rotation).toBe(0); expect(occupied(state)).toBe(0);
  });
}

test('dos dedos cancelan el contacto completo; el segundo tampoco activa Reserva', async ({ page }) => {
  await load(page); const f = await finger(page), reserve = (await page.locator('#hold-box').boundingBox())!;
  const a = { x: f.x, y: f.y, id: 1 }, b = { x: f.x + f.cell * 2, y: f.y, id: 2 };
  await f.send('touchStart', [a]); await f.send('touchStart', [a, b]);
  await f.send('touchEnd', [a]); await f.move(f.cell * 3, f.cell * 5); await f.end();
  let state = await checkpoint(page); expect(state.active.x).toBe(3); expect(state.active.rotation).toBe(0); expect(occupied(state)).toBe(0);
  await page.locator('#play').tap(); await f.start();
  await f.send('touchStart', [a, { x: reserve.x + 20, y: reserve.y + 20, id: 2 }]);
  await f.send('touchEnd', [a]); await f.end();
  state = await checkpoint(page); expect(state.holdUsed).toBe(false); expect(state.active.rotation).toBe(0);
  await page.locator('#play').tap(); await f.start(f.cell * 2); await f.end();
  expect((await checkpoint(page)).active.rotation).toBe(1);
});

for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
  test(`Gestos ${size.width}×${size.height}: tablero completo, casillas cuadradas y captura móvil`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    const state = sample(); state.score = 1280; state.lines = 8; state.hold = 'I'; state.next = 'L'; state.active.y = 6;
    const game = new Game(() => .4, state); game.resume();
    for (const move of ['left', 'drop', 'right', 'right', 'drop', 'left', 'drop'] as const) game.act(move);
    game.state.active = { type: 'T', x: 3, y: 6, rotation: 0 }; game.state.hold = 'I'; game.state.next = 'L';
    await load(page, game.snapshot());
    await expect(page.locator('.controls')).toBeHidden();
    const dimensions = await page.evaluate(() => {
      const board = document.querySelector('#board')!.getBoundingClientRect();
      const stage = document.querySelector('.stage')!.getBoundingClientRect();
      return { width: board.width, height: board.height, bottom: board.bottom, max: Math.min(stage.width - 2, (stage.height - 2) / 2), scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight };
    });
    expect(dimensions.scrollWidth).toBe(size.width); expect(dimensions.scrollHeight).toBe(size.height);
    expect(dimensions.bottom).toBeLessThanOrEqual(size.height); expect(dimensions.height / dimensions.width).toBeCloseTo(2, 2); expect(dimensions.width).toBeCloseTo(dimensions.max, 0);
    for (const id of ['#help', '#pause', '#hold-box']) {
      const b = (await page.locator(id).boundingBox())!; expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44); await expect(page.locator(id)).toBeInViewport();
    }
    expect(await page.locator('#board').evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
    expect(await page.locator('#help-dialog').evaluate(el => getComputedStyle(el).touchAction)).toBe('auto');
    writeFileSync(testInfo.outputPath('dimensiones.json'), JSON.stringify({ viewport: size, ...dimensions }, null, 2));
    await page.screenshot({ path: `test-results/gestos-${size.width}x${size.height}.png`, fullPage: true });
  });
}

test('ayuda y explicación con poca altura y texto ampliado desplazan sin activar el tablero', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 400 }); await load(page, sample(), false);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' }); await page.locator('#help').tap();
  await page.getByRole('radio', { name: 'Gestos', exact: true }).check();
  const before = await stored(page);
  await page.locator('#start-gestures').scrollIntoViewIfNeeded(); await expect(page.locator('#start-gestures')).toBeInViewport();
  expect((await stored(page)).active).toEqual(before.active);
  expect(await page.locator('#gesture-dialog').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight > el.clientHeight)).toBe(true);
  await page.locator('#start-gestures').tap(); await page.locator('#help').tap();
  await page.getByRole('radio', { name: 'Botones', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-control-mode', 'buttons');
});

test('preferencia, recuperación y controles de gestos funcionan también tras recarga offline', async ({ page, context }) => {
  await load(page); await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
  const before = await checkpoint(page); await context.setOffline(true); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-control-mode', 'gestures');
  expect((await stored(page)).active).toEqual(before.active);
  await page.locator('#play').tap(); const f = await finger(page); await f.start(); await f.move(0, f.cell * 6); await f.end();
  expect(occupied(await checkpoint(page))).toBe(4); await context.setOffline(false);
});
